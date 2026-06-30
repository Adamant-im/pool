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
    const isTTY = Boolean(stdin.isTTY);

    // Prompts and echo go to stderr so stdout carries only command output.
    const rl = readline.createInterface({
      input: stdin,
      output: stderr,
      terminal: isTTY,
    });

    // Resolve to '' if the stream ends before an answer (e.g. EOF on a pipe).
    rl.on('close', () => resolve(''));

    if (isTTY) {
      // Mask everything readline would echo; only render the newline on Enter.
      rl._writeToOutput = (chunk) => {
        if (chunk === '\r\n' || chunk === '\n' || chunk === '\r') {
          rl.output.write('\n');
        }
      };

      stderr.write(query);

      rl.question('', (answer) => {
        rl.close();
        resolve(answer);
      });

      return;
    }

    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
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
