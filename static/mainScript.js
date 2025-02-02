function sleep(ms) { //simple wait-type function
    return new Promise(resolve => setTimeout(resolve, ms));
}

function main(){ //redirect to main page
    window.location.href = "/main";
}

function setup(username, notesCollection){ //setup runs on main page redirect; setup gridbox with notes
    document.getElementById("welcomeMsg").innerText = `Welcome, ${username}!`;
    //creating a "create" button
    let icon = document.createElement("div");
    icon.className = "noteIcon";
    let noteTitle = document.createElement("h1");
    noteTitle.innerText = "+";
    noteTitle.className = "createButton";
    icon.appendChild(noteTitle);
    icon.onclick = createNotes;
    document.getElementById("notesHolder").appendChild(icon);

    //now handle user's note collection data
    if(notesCollection.length == 0){ //no notes yet?
        document.getElementById("noNotes").innerText = "You have no notes!"
    }else{
        console.log(notesCollection);
        for(let i = 0; i < notesCollection.length; i++){ //make a clickable div for every note in notesCollection
            let icon = document.createElement("div");
            icon.className = "noteIcon";
            let noteTitle = document.createElement("h1");
            noteTitle.innerText = notesCollection[i][0];
            noteTitle.className = "notesTitle";
            let preview = document.createElement("p");
            preview.innerText = `${notesCollection[i][1].substring(0,250)}...`;
            icon.appendChild(noteTitle);
            icon.appendChild(preview);
            icon.onclick = function(){
                displayNote(notesCollection[i][0], notesCollection[i][1]);
            }
            document.getElementById("notesHolder").appendChild(icon);
        }
    }
}

function displayNote(title, preview){ //when note is clicked in gridbox, display its information
    fetch("/displayNote",{
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({"data":[title, preview]})
    })
    .then(response=>{
        if(!response.ok){
            console.log("response not ok");
        }else{
            return response.json();
        }
    })
    .then(data=>{
        if(data.message == "euge"){
            window.location.href = "/redirectDisplay";
        }else{
            console.log("error!");
        }
    })
    .catch(err=>{
        console.log(err);
    })
}

function loadDisplay(noteTitle, noteBody){ //load information on noteDisplay page
    document.getElementById("notesTitle").innerText = noteTitle;
    document.getElementById("notesBody").innerText = noteBody;
}

function createNotes(){ //redirect to note creation page
    window.location.href = "/createNote";
}

//web request api-- microphone input -> flask (BIG PART!!)

let audioChunks = [];
let audioContext, analyzer, source;
let silenceTimer, isListening = false;
let mediaStream;
let silenceTimeout;
let silenceCheckAnimFrame;
let recorder;
let mediaRecorder;
let firstTime = true;
let silent = false;
let dataSent = false;
let switchIcon = true;

function record(){ //start getting input
    if(switchIcon == true){
        switchIcon = false;
        document.getElementById("startRecord").style.display = "none";
        document.getElementById("stopRecord").style.display = "block";
        document.getElementById("infoMsg").innerText = "Click again to stop taking notes...";
    }
    
    navigator.mediaDevices.getUserMedia({audio:true})
    .then((stream)=>{
        mediaStream = stream;
        audioContext = new(window.AudioContext)();
        analyzer = audioContext.createAnalyser();
        source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyzer);

        mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };

        mediaRecorder.start();
        
        mediaRecorder.onstop = async () => { //send audio files -> backend for transcription
            console.log("data sent to flask right now!!!111!1");
            let audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            await convertWebmWav(audioBlob); //convert webm to wav directly w/ js
        };

        //volume checking: pause detection
        analyzer.fftSize = 256;
        const bufferLength = analyzer.frequencyBinCount;
        const buffer = new Uint8Array(bufferLength);
       
        function checkIfSilent() {
            if (silent && !dataSent) { //send flask data here
                stopRecording();
                record();
                dataSent = true;
            }
        }

        function monitorSilence(){        
            analyzer.getByteTimeDomainData(buffer);
            
            //get volume of audio input...
            let volSum = 0;
            for(let i = 0; i < bufferLength; i++){
                volSum+=Math.abs(buffer[i]-128);
            }
       
            let vol = volSum/bufferLength;
       
            if(vol < 2){
                if(silent == false){
                    silent = true
                    silenceTimeout = setTimeout(checkIfSilent, 1500); //if silent for 1.5 seconds -> send data
                }
            }else{
                clearTimeout(silenceTimeout); //break timeout...not silent for 1.5 seconds
                silent = false;
                dataSent = false;
            }
            silenceCheckAnimFrame = requestAnimationFrame(monitorSilence);
        }

        monitorSilence();
    })
}

//following 4 functions for webm->wav

async function convertWebmWav(audioBlob){ //first function-- decode audio data + send to 2nd func
    let audioContext = new window.AudioContext();
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    let reader = new FileReader();
    reader.onloadend = async () => {
        try{
            let audioBuffer = await audioContext.decodeAudioData(reader.result)
            exportToWav(audioBuffer);
            audioContext.close();
        }catch(e){
            console.log(e);
        }
    };
    reader.readAsArrayBuffer(audioBlob);
}

function exportToWav(audioBuffer){ //second function-- create blob from generated wavData, send to flask backend
    let wavData = encodeWav(audioBuffer);
    let wavBlob = new Blob([wavData], { type: "audio/wav" });

    let formData = new FormData();
    formData.append("file", wavBlob, "audio.wav");

    fetch("/notes", {
        method: "POST",
        body: formData
    })

    .then(response=>{
        if(!response.ok){
            console.log('response not ok')
        }else{
            return response.json();
        }
    })

    .then(data=>{
        if(data.message=="euge"){
            if(data.notes != ""){
                isListening = true;
                let notesData = data.notes.split("!SPLIT_TITLE!");
                document.getElementById("notesTitle").innerText = notesData[0];
                document.getElementById("notesDisplay").innerText = notesData[1];
            }
        }else{
            console.log("there was an error!")
            console.log(data.message);
        }
    })

    .catch(err=>{
        console.log(err);
    })
}

function encodeWav(audioBuffer){ //third function-- compose wavfile format
    let bufferLength = audioBuffer.length;
    let numOfChannels = audioBuffer.numberOfChannels;
    let sampleRate = audioBuffer.sampleRate;

    let data = [];

    for(let i = 0; i < bufferLength; i++){
        for(let channel = 0; channel < numOfChannels; channel++){
            let sample = audioBuffer.getChannelData(channel)[i];
            let pcmSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
            data.push(pcmSample & 0xFF);
            data.push((pcmSample >> 8) & 0xFF);
        }
    }

    let wavHeader = createWavHeader(bufferLength, numOfChannels, sampleRate);
    let wavFile = new Uint8Array(wavHeader.length + data.length);

    wavFile.set(wavHeader);
    wavFile.set(new Uint8Array(data), wavHeader.length);

    return wavFile;
}

function createWavHeader(length, numOfChannels, sampleRate) { //fourth function-- create wavefile header
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + length * 2, true); // File size
    view.setUint32(8, 0x45564157, true); // "WAVE"
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numOfChannels, true); // NumChannels (1 for mono, 2 for stereo)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numOfChannels * 2, true); // ByteRate
    view.setUint16(32, numOfChannels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, length * 2, true); // Data chunk size

    return new Uint8Array(header);
}

function stopRecording(){ //run func when recording temporarily stopped
    clearTimeout(silenceTimeout);
    cancelAnimationFrame(silenceCheckAnimFrame);
    mediaRecorder.stop();
    if(mediaStream){
        mediaStream.getTracks().forEach(track => track.stop());
    }
    audioChunks = [];
    audioContext, analyzer, source;
    silenceTimer, isListening = false;
    mediaStream;
    silenceCheckAnimFrame;
    recorder;
    mediaRecorder;
    firstTime = true;
    silent = false;
    dataSent = false;
}

function stop(){ //run func when recording permanently stopped
    stopRecording();
    let title = document.getElementById("notesTitle").innerText;
    let body = document.getElementById("notesDisplay").innerText;
    
    let data = [title, body];

    fetch("/success", {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({"data": [title, body]})
    })
    .then(response=>{
        if(!response.ok){
            console.log("response not ok");
        }else{
            return response.json();
        }
    })
    .then(data=>{
        if(data.message == "euge"){
            console.log("successful");
            window.location.href = "/redirectSuccess";
        }else{
            console.log("eheu!!");
        }
    })
    .catch(err=>{
        console.log(err);
    })
}

//end of note creation functions...

function showRename(){ //display renaming div
    document.getElementById("titleRename").value = document.getElementById("notesTitle").innerText;
    document.getElementById("rename").style.display = "block";
    document.getElementById("notesTitle").style.display = "none";
}

function rename(){ //rename notes
    document.getElementById("rename").style.display = "none";
    document.getElementById("notesTitle").innerText = document.getElementById("titleRename").value;
    document.getElementById("notesTitle").style.display = "block";
    fetch("/renameNote",{
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({"data": document.getElementById("notesTitle").innerText})
    })
    .then(response=>{
        if(!response.ok){
            console.log("response not ok");
        }else{
            return response.json();
        }
    })
    .then(data=>{
        if(data.message == "euge"){
            document.getElementById("funcInfo").innerText = "notes renamed successfully";
            sleep(2000).then(()=>{
                document.getElementById("funcInfo").innerText = "";
            })
        }else{
            console.log("error!");
        }
    })
    .catch(err=>{
        console.log(err);
    })
}

function showEdit(){ //display edit div
    document.getElementById("notesEdit").value = document.getElementById("notesBody").innerText;
    document.getElementById("edit").style.display = "block";
    document.getElementById("notesBody").style.display = "none";
}

function edit(){ //edit notes
    document.getElementById("edit").style.display = "none";
    document.getElementById("notesBody").innerText = document.getElementById("notesEdit").value;
    document.getElementById("notesBody").style.display = "block";
    fetch("/editNote",{
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({"data": document.getElementById("notesBody").innerText})
    })
    .then(response=>{
        if(!response.ok){
            console.log("response not ok");
        }else{
            return response.json();
        }
    })
    .then(data=>{
        if(data.message == "euge"){
            document.getElementById("funcInfo").innerText = "notes edited successfully";
            sleep(2000).then(()=>{
                document.getElementById("funcInfo").innerText = "";
            })
        }else{
            console.log("error!");
        }
    })
    .catch(err=>{
        console.log(err);
    })
}

function showDelete(){ //show delete div
    document.getElementById("deleteDiv").style.display = "block";
    document.getElementById("deleteDiv").animate([
        {top: "100%"},
        {transform: "translate(-50%, -50%)"}
    ], {duration: 200, easing: "ease-out"});
    document.getElementById("overlay").animate([
        {opacity: 0.5}
    ], {duration: 200, easing: "ease-out"})
    sleep(200).then(()=>{
        document.getElementById("deleteDiv").style.top = "50%";
        document.getElementById("deleteDiv").style.transform = "translate(-50%, -50%)";
        document.getElementById("overlay").style.opacity = 0.5;
    })
}

function hideDelete(){ //hide delete div
    document.getElementById("deleteDiv").animate([
        {opacity: 0}
    ], {duration: 200, easing: "ease-out"})
    document.getElementById("overlay").animate([
        {opacity: 0}
    ], {duration: 200, easing: "ease-out"})
    sleep(200).then(()=>{
        document.getElementById("deleteDiv").style.display = "none";
        document.getElementById("deleteDiv").style.top = "50%";
        document.getElementById("deleteDiv").style.transform = "translate(-50%, -50%)";
        document.getElementById("overlay").style.opacity = 0;
    })
}

function deleteNote(){ //delete note!!
    document.getElementById("deleteInfo").innerText = "Deleting...";
    sleep(2000).then(()=>{
        document.getElementById("deleteInfo").innerText = "";
        document.getElementById("deleteDiv").style.display = "none";
        fetch("/deleteNote",{
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            }
        })
        .then(response=>{
            if(!response.ok){
                console.log("response not ok");
            }else{
                return response.json();
            }
        })
        .then(data=>{
            if(data.message == "euge"){
                document.getElementById("funcInfo").innerText = "Deleted. Redirecting...";
                sleep(2000).then(()=>{
                    main();
                })
            }else{
                console.log("error!");
            }
        })
        .catch(err=>{
            console.log(err);
        })
    })
}