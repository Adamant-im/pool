import readline from 'node:readline';

/**
 * Prompts for a line of input on stdin, masking the typed characters when a
 * terminal is attached so passphrases and operator passwords are never echoed.
 *
 * When stdin is not a TTY (piped or redirected input), the line is read without
 * masking — the input is not visible on screen anyway — and an EOF before any
 * answer resolves to an empty string so callers never hang.
 * @param {string} query Prompt text to display
 * @returns {Promise<string>} The entered value (without the trailing newline)
 */
export function promptHidden(query) {
  return new Promise((resolve) => {
    const { stdin, stderr } = process;

    // Non-interactive fallback: read a line without masking (the input is piped,
    // so it is not visible anyway). EOF before an answer resolves to ''.
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      const rl = readline.createInterface({ input: stdin, output: stderr, terminal: false });

      rl.on('close', () => resolve(''));
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });

      return;
    }

    // Interactive: enable raw mode first (disables terminal echo), then render
    // the prompt and read keystrokes, echoing only a mask so the prompt stays
    // visible and the secret is never shown.
    const wasRaw = stdin.isRaw;
    let input = '';

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    stderr.write(query);

    const finish = (value) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stderr.write('\n');
      resolve(value);
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        // Enter (CR/LF) or Ctrl-D finishes the input.
        if (char === '\n' || char === '\r' || char === '\u0004') {
          finish(input);
          return;
        }

        // Ctrl-C aborts.
        if (char === '\u0003') {
          stdin.setRawMode(wasRaw);
          stdin.pause();
          stderr.write('\n');
          process.exit(130);
        }

        // Backspace / Delete removes the last character.
        if (char === '\u007f' || char === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            stderr.write('\b \b');
          }

          continue;
        }

        // Ignore other control characters (arrows, etc.).
        if (char < ' ') {
          continue;
        }

        input += char;
        stderr.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

/**
 * Creates a prompter for reading one or more hidden inputs in sequence.
 *
 * With a terminal attached each prompt is read interactively and masked. When
 * stdin is piped/redirected (tests, automation), the whole input is buffered
 * once and the prompts consume it line by line, which avoids losing lines
 * across multiple readline interfaces.
 * @returns {{ask: (query: string) => Promise<string>}} A prompter with an async `ask`
 */
export function createHiddenPrompter() {
  if (process.stdin.isTTY) {
    return { ask: promptHidden };
  }

  let linesPromise = null;
  let index = 0;

  const loadLines = () => new Promise((resolve) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.once('end', () => resolve(data.split(/\r?\n/)));
  });

  return {
    async ask(query) {
      process.stderr.write(query);

      if (!linesPromise) {
        linesPromise = loadLines();
      }

      const lines = await linesPromise;

      return lines[index++] ?? '';
    },
  };
}
