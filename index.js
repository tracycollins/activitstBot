const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const record = require("node-record-lpcm16");
const speech = require("@google-cloud/speech");
const treeify = require("treeify");

const clientSpeechToText = new speech.SpeechClient();
const clientTextToSpeech = new textToSpeech.TextToSpeechClient();

const player = require("play-sound")(opts = {});

const encoding = "LINEAR16";
const sampleRateHertz = 16000;
const languageCode = "en-US";


let talkTextQueue = [];


const jsonPrint = function (obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

async function quit(options) {

  console.log("QUITTING ..." );

  let forceQuitFlag = false;

  if (options) { 
    console.log("OPTIONS\n" + jsonPrint(options));
    forceQuitFlag = options.force || false;
  }

  setTimeout(function(){  process.exit(); }, 1000);
};


const requestSpeechToText = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
  },
  interimResults: false, // If you want interim results, set this to true
};

let requestTextToSpeech = {};
requestTextToSpeech.voice = {};
requestTextToSpeech.voice.languageCode = "en-US";
requestTextToSpeech.voice.ssmlGender = "NEUTRAL";
requestTextToSpeech.audioConfig = {};
requestTextToSpeech.audioConfig.audioEncoding = "MP3";
requestTextToSpeech.input = {};
requestTextToSpeech.input.text = "";

let recordObj;
let recognizeStream;

function startRecord(){

  startRecognizeStream();

  recordObj = record
    .start({
      sampleRateHertz: sampleRateHertz,
      threshold: 0,
      verbose: false,
      recordProgram: "rec", // Try also "arecord" or "sox"
      silence: "0.5",
    })
    .on("error", console.error)
    .pipe(recognizeStream);
  return;
}

function stopRecord(){
  if (recordObj) { recordObj.end(); }
}


function startRecognizeStream(){

  recognizeStream = clientSpeechToText
    .streamingRecognize(requestSpeechToText)
    .on("end", function(){ console.log("END"); })
    .on("error", function(err){

      console.log("*** ERROR | SPEECH-TO-TEXT\n" + jsonPrint(err));

      if (err.code === 11) {
        console.log("SPEECH-TO-TEXT TIME LIMIT");
        requestTextToSpeech.input.text = "Sorry! Gotta go cuz we're out of time. Later!";
        talkText(requestTextToSpeech, function(){
          quit();
        });
      }
      else {
        console.log("QUITTING: SPEECH-TO-TEXT ERROR: ", err);
        quit();
      }
    })
    .on("data", function(data){

      if (data.results[0] && data.results[0].alternatives[0]) {
        talkTextQueue.push(data);
      }
      else {
        console.log("SPEECH-TO-TEXT ERROR | END TIME");
        quit();
      }

    });
}

let talkTextInterval;

function initTalkTextInterval(interval){

  clearInterval(talkTextInterval);

  let data;
  let talkTextReady = true;

  talkTextInterval = setInterval(function(){

    if (talkTextReady && (talkTextQueue.length > 0)) {

      talkTextReady = false;

      data = talkTextQueue.shift();

      // if (data.results[0] && data.results[0].alternatives[0]) {

        let text = data.results[0].alternatives[0].transcript.trim();

        console.log("YOU SAID: " + text);

        if (text === "quit") {

          requestTextToSpeech.input.text = "Quitting!";

          talkText(requestTextToSpeech, function(){
            talkTextReady = true;
            quit();
          });
        }
        else {

          requestTextToSpeech.input.text = text;

          stopRecord();

          talkText(requestTextToSpeech, function(){

            setTimeout(function(){

              startRecord();
              talkTextReady = true;

            }, 500);

          });
        }

      // else {
      //   console.log("SPEECH-TO-TEXT ERROR | END TIME");
      //   talkTextReady = true;
      //   quit();
      // }
    }

  }, 500);

}


function talkText(params, callback){

  clientTextToSpeech.synthesizeSpeech(params, (err, response) => {
    if (err) {
      console.error("clientTextToSpeech ERROR:", err);
      return callback(err);
    }


    fs.writeFile("output.mp3", response.audioContent, "binary", function(err) {
      if (err) {
        console.error("fs.writeFile ERROR:", err);
        return callback(err);
      }

      player.play("output.mp3", function(err1){
        if (err1) {
          console.error("PLAYER ERROR: ", err1);
          return callback(err1);
        }

        callback();

      });

      // console.log("Audio content written to file: output.mp3");

    });
  });
}

let runInterval;

function run(interval){

  initTalkTextInterval(1000);
  // startRecognizeStream();
  startRecord();

  console.log("Listening, press Ctrl+C to stop.");

  runInterval = setInterval(function(){

  }, interval);
}

run(1000);