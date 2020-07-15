# activitstBot

I created this bot for several actions by the United Artists & Activists Union (UAAU) [https://www.facebook.com/unitedartistsandactivistsunion]

It's a chat bot with speech-to-text and text-to-speech capabilities which allow it to "listen" to nearby voices, recognize words (English, for now), and then respond with speech.

Built on Google Cloud's Speech (https://github.com/googleapis/nodejs-speech) and Text-To-Speech (https://github.com/googleapis/nodejs-text-to-speech)

Installation

clone then npm install

Your system will require an audio module to record speech files which are sent to Google Cloud for speech-to-text.
I've only ever tried and used node-record-lpcm16 (https://github.com/gillesdemey/node-record-lpcm16) with SoX (http://sox.sourceforge.net/)
