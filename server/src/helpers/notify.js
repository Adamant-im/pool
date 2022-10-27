import axios from 'axios';

import api from './api.js';
import log from './log.js';
import config from './config/reader.js';

const {
  adamant_notify: adamantNotify,
  slack,
} = config;

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
              log.log(`Request to Slack with message ${message} failed. ${error}.`);
            });
      }

      if (adamantNotify && adamantNotify.length > 5 && adamantNotify.startsWith('U') && config.passPhrase && config.passPhrase.length > 30) {
        const mdMessage = makeBoldForMarkdown(message);

        api.sendMessage(config.passPhrase, adamantNotify, `${type}| ${mdMessage}`)
            .then((response) => {
              if (!response.success) {
                log.warn(`Failed to send notification messsage '${mdMessage}' to ${adamantNotify}. ${response.errorMessage}.`);
              }
            });
      }
    }
  } catch (e) {
    log.error('Notifier error: ' + e);
  }
};

function removeMarkdown(text) {
  return doubleAsterisksToSingle(text).replace(/([_*]\b|\b[_*])/g, '');
}

function doubleAsterisksToSingle(text) {
  return text.replace(/(\*\*\b|\b\*\*)/g, '*');
}

function singleAsteriskToDouble(text) {
  return text.replace(/(\*\b|\b\*)/g, '**');
}

function makeBoldForMarkdown(text) {
  return singleAsteriskToDouble(doubleAsterisksToSingle(text));
}

function makeBoldForSlack(text) {
  return doubleAsterisksToSingle(text);
}
