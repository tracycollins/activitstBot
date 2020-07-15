const TALK_TEXT_INTERVAL = 10;
const RUN_INTERVAL = 1000;

const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const recorder = require("node-record-lpcm16");
// const speech = require("@google-cloud/speech");
const treeify = require("treeify");

// const clientSpeechToText = new speech.v1p1beta1.SpeechClient();
const speech = require("@google-cloud/speech");
const clientSpeechToText = new speech.SpeechClient();

const clientTextToSpeech = new textToSpeech.TextToSpeechClient();

const opts = {};
const player = require("play-sound")(opts);

const encoding = "LINEAR16";
const sampleRateHertz = 16000;
const languageCode = "en-US";

const talkTextQueue = [];


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

  if (options) { 
    console.log("OPTIONS\n" + jsonPrint(options));
  }

  setTimeout(function(){ process.exit(); }, 1000);
}


const requestSpeechToText = {
  config: {
    singleUtterance: true,
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
  },
  interimResults: false, // If you want interim results, set this to true
};

const requestTextToSpeech = {};
requestTextToSpeech.voice = {};
requestTextToSpeech.voice.languageCode = "en-US";
requestTextToSpeech.voice.ssmlGender = "NEUTRAL";
requestTextToSpeech.audioConfig = {};
requestTextToSpeech.audioConfig.audioEncoding = "MP3";
requestTextToSpeech.input = {};
requestTextToSpeech.input.text = "";

let recordObj;
let recognizeStream;
let recognizeStreamReady = false;

async function startRecord(){

  try{
    console.log("startRecord");

    recognizeStream = await startRecognizeStream();

    if (!recognizeStream) { 
      console.log("*** ERROR startRecord | recognizeStream UNDEFINED ???");
      return null;
    }

    const recording = recorder.record()
    recording.stream().pipe(recognizeStream)

    if (!recognizeStreamReady) { 
      console.log("*** ERROR startRecord | recognizeStream NOT READY");
      return null;
    }

    return recording;
  }
  catch(err){
    console.log("*** ERROR startRecord | ", err);
  }
}

function stopRecord(){
  if (recordObj) {
    console.log("stopRecord");
    recordObj.stop();
    return true;
  }
  return false;
}


function startRecognizeStream(){

  const rcgs = clientSpeechToText
    .streamingRecognize(requestSpeechToText)
    .on("end", function(){ 
      recognizeStreamReady = false;
      console.log("streamingRecognize END");
    })
    .on("drain", function(){ 
      recognizeStreamReady = false;
      console.log("streamingRecognize DRAIN");
    })
    .on("finish", function(){ 
      recognizeStreamReady = false;
      console.log("streamingRecognize FINISH");
    })
    .on("pipe", function(){ 
      recognizeStreamReady = true;
      console.log("streamingRecognize PIPE");
    })
    .on("close", function(){
      recognizeStreamReady = false;
      console.log("streamingRecognize CLOSE");
    })
    .on("error", async function(err){

      recognizeStreamReady = false;

      console.log("*** ERROR | SPEECH-TO-TEXT\n" + jsonPrint(err));

      if (err.code === 11) {
        console.log("SPEECH-TO-TEXT TIME LIMIT | RESTARTING...");
        recordObj = await startRecord();
      }
      else {
        console.log("QUITTING: streamingRecognize SPEECH-TO-TEXT ERROR: ", err);
        await stopRecord();
       }
    })
    .on("unpipe", function(){ 
      recognizeStreamReady = false;
      console.log("streamingRecognize UNPIPE");
    })
    .on("data", async function(data){

      recognizeStreamReady = true;

      await stopRecord();

      if (data.results[0] && data.results[0].alternatives[0]) {
        talkTextQueue.push(data);
      }
      else {
        console.log("SPEECH-TO-TEXT ERROR | END TIME");
      }

    });

  return rcgs;
}

let talkTextInterval;

function initTalkTextInterval(interval){

  clearInterval(talkTextInterval);

  let data;
  let talkTextReady = true;

  talkTextInterval = setInterval(async function(){

    if (talkTextReady && (talkTextQueue.length > 0)) {

      talkTextReady = false;

      data = talkTextQueue.shift();

      const text = data.results[0].alternatives[0].transcript.trim();

      if (text === "quit") {

        requestTextToSpeech.input.text = "Quitting!";

        talkText(requestTextToSpeech, function(){
          talkTextReady = true;
          quit();
        });
      }
      else {

        requestTextToSpeech.input.text = text;

        talkText(requestTextToSpeech, async function(){
          recordObj = await startRecord();
          talkTextReady = true;
        });
      }
    }

  }, interval);

}


function talkText(params, callback){

  console.log("TALKING: " + params.input.text);

  clientTextToSpeech.synthesizeSpeech(params, function(err, response){

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

    });

  });
}

async function run(){

  initTalkTextInterval(TALK_TEXT_INTERVAL);

  try {
    requestTextToSpeech.input.text = "United Artists and Activists Union!";

    talkText(requestTextToSpeech, async function(){
      recordObj = await startRecord();
    });

  }
  catch(err){
    console.log("RUN ERROR: ", err);
  }

  console.log("Listening, press Ctrl+C to stop.");

  return;

}

run(RUN_INTERVAL);
