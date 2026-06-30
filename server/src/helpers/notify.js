import adamantApiClient from './adamantApiClient.js';
import axios from 'axios';
import config from './config/reader.js';
import log from './log.js';

const {
  adamant_notify: adamantNotify,
  slack,
} = config;

/**
 * Logs a message and sends configured ADAMANT or Slack notifications.
 * @param {string} message Notification message
 * @param {'error'|'warn'|'info'|'log'} type Notification severity
 * @param {boolean} [silentMode=false] Whether to skip external notification channels
 * @returns {void}
 */
export default (message, type, silentMode = false) => {
  try {
    log[type](removeMarkdown(message));

    if (!silentMode) {
      if (!slack && !adamantNotify) {
        return;
      }

      const colors = {
        error: '#FF0000',
        warn: '#FFFF00',
        info: '#00FF00',
        log: '#FFFFFF',
      };

      const color = colors[type];

      const params = {
        'attachments': [{
          'fallback': message,
          'color': color,
          'text': makeBoldForSlack(message),
          'mrkdwn_in': ['text'],
        }],
      };

      if (slack && slack.length > 34) {
        axios.post(slack, params)
            .catch((error) => {
              log.warn(`Failed to send notification message '${message}' to Slack. ${error}.`);
            });
      }

      if (adamantNotify && adamantNotify.length > 5 && adamantNotify.startsWith('U') && config.passPhrase && config.passPhrase.length > 30) {
        const mdMessage = makeBoldForMarkdown(message);

        adamantApiClient.sendMessage(config.passPhrase, adamantNotify, `${type}| ${mdMessage}`)
            .then((response) => {
              if (!response.success) {
                log.warn(`Failed to send notification message '${mdMessage}' to ${adamantNotify}. ${response.errorMessage}.`);
              }
            });
      }
    }
  } catch (e) {
    log.error('Notifier error: ' + e);
  }
};

/**
 * Removes Markdown emphasis markers from a notification message.
 * @param {string} text Message text
 * @returns {string} Plain text message
 */
function removeMarkdown(text) {
  return doubleAsterisksToSingle(text).replace(/([_*]\b|\b[_*])/g, '');
}

/**
 * Converts bold Markdown markers to single asterisks.
 * @param {string} text Message text
 * @returns {string} Converted message text
 */
function doubleAsterisksToSingle(text) {
  return text.replace(/(\*\*\b|\b\*\*)/g, '*');
}

/**
 * Converts single asterisk emphasis markers to bold Markdown markers.
 * @param {string} text Message text
 * @returns {string} Converted message text
 */
function singleAsteriskToDouble(text) {
  return text.replace(/(\*\b|\b\*)/g, '**');
}

/**
 * Normalizes emphasis markers for ADAMANT Markdown messages.
 * @param {string} text Message text
 * @returns {string} Markdown-safe message text
 */
function makeBoldForMarkdown(text) {
  return singleAsteriskToDouble(doubleAsterisksToSingle(text));
}

/**
 * Normalizes emphasis markers for Slack messages.
 * @param {string} text Message text
 * @returns {string} Slack-safe message text
 */
function makeBoldForSlack(text) {
  return doubleAsterisksToSingle(text);
}
