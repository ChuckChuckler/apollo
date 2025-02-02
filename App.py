#dependencies 
from flask import Flask, json, jsonify, render_template, request
import hashlib
import sqlite3
import google.generativeai as genai
import speech_recognition as sr

#configuring gemini api
gemini_apikey = "AIzaSyDwc7y7YOWaBlSopVLwRXmayN0jKGpvGVE" #placeholder value for safety
genai.configure(api_key=gemini_apikey)
model = genai.GenerativeModel("gemini-1.5-flash")

#important global variables
notes = "" #for later transcriptions

#shared info between pages
user = ""
passw_encoded = ""
notesColl = None
noteTitle = ""
noteBody = ""

app = Flask(__name__, template_folder="templates", static_folder="static")

@app.route("/") #display signup/login
def index():
    return render_template("login.html")

@app.route("/signUp", methods=["GET", "POST"]) #sign up request
def signUp():
    if not request.json:
        print("no request")
        return jsonify({"message": "eheu!"})
    elif "data" not in request.json:
        print("no data")
        return jsonify({"message":"eheu!"})
    else:
        global user
        global passw_encoded
        global notesColl
        
        userData = request.json["data"]
        user = userData[0]
        passw = userData[1]
        passw_encoded = bytes(str(passw), encoding="utf-8")
        passw_encoded = hashlib.sha256(passw_encoded, usedforsecurity=True).hexdigest()

        conn = sqlite3.connect("userdata.db")
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS userdata(username, password, notesCollection)")
        if(user, ) in cur.execute("SELECT username FROM userdata").fetchall():
            print('user already exists')
            return jsonify({"message":"Username already exists."})
        else:
            notesColl = json.dumps([])
            cur.execute("INSERT INTO userdata VALUES (?, ?, ?)", (user, passw_encoded, notesColl))
            conn.commit()
            conn.close()
            notesColl = json.loads(notesColl)
            return jsonify({"message":"euge", "redirect":"/main"})


@app.route("/logIn", methods=["GET", "POST"]) #log in request
def logIn():
    if not request.json:
        print("no request")
        return jsonify({"message": "eheu!"})
    elif "data" not in request.json:
        print("no data")
        return jsonify({"message":"eheu!"})
    else:
        global user
        global notesColl
        global passw_encoded

        userData = request.json["data"]
        user = userData[0]
        passw = userData[1]
        passw_encoded = bytes(str(passw), encoding="utf-8")
        passw_encoded = hashlib.sha256(passw_encoded, usedforsecurity=True).hexdigest()

        conn = sqlite3.connect("userdata.db")
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS userdata(username, password, notesCollection)")
        if(user, ) not in cur.execute("SELECT username FROM userdata").fetchall():
            print('user does not exist')
            return jsonify({"message":"Username not found."})
        elif(user, passw_encoded) not in cur.execute("SELECT username, password FROM userdata").fetchall():
            print('incorrect password')
            return jsonify({"message":"Incorrect password."})
        else:
            notesColl = json.loads(cur.execute("SELECT notesCollection FROM userdata WHERE (username, password) = (?,?)", (user, passw_encoded)).fetchone()[0])
            conn.commit()
            conn.close()
            return jsonify({"message":"euge", "redirect":"/main"})
        
@app.route("/main", methods=["GET", "POST"]) #redirect to main
def redirectMain():
    global user
    global notesColl
    global notes

    notes = ""
    
    return render_template("main.html", username=str(user), notesCollection=notesColl)

@app.route("/createNote", methods=["GET"]) #redirect to new note creation
def redirectCreate():
    return render_template("record.html")

@app.route("/notes", methods=["GET", "POST"]) #speech recognition and notes
def listen(): 
    global notes

    audioFile = request.files["file"]
    audioFile.save('temp.wav')

    #setting up the recognizer
    r = sr.Recognizer() 

    #now, taking + processing audio...
    audioSource = sr.AudioFile('temp.wav')
    with audioSource as source:
        audio_text = r.listen(source, timeout=30, phrase_time_limit=60)
        try:
            transcribed = r.recognize_google(audio_text)

            #...send transcript to geminiapi, generate notes  
            response = model.generate_content(f"\
                Assume the text you are about to receive is going to become a part of a student's notes. Reformat the block of text using the following process:\
                Step 1: Make the text grammatically correct. Add correct punctuation.\
                Step 2: The text may have some issues, mostly regarding missing words or incorrect phrases. Process the text for the main topic or point. Fill in awkward spaces with smoothly-flowing related words, and replace phrases that do not pertain to the main topic, but are similar to phrases that do. Do NOT add any EXTRA information.\
                Step 3: Eliminate any part(s) of the text that do(es) not pertain directly to the main topic/point.\
                Step 4: Rewrite the text in a bulleted-notes-style format.\
                The text is: '{transcribed}'.\
                Generate only step 4. Do not add extra symbols. No asteriks unless they represent bullet points. Let this be called segment.\
                Now, assume that 'segment' is part of a larger text. The larger text is:\
                {notes}\
                (if this is blank, you may assume that 'segment' is the first part of the larger text.)\
                Your response should be the entirety of the larger text, with 'segment' integrated seamlessly so that it flows like a student's notes. Add headings/subsections as necessary.\
                Also, at the beginning of the response, include a relevant title for the notes, and separate this title with the phrase !SPLIT_TITLE!.\
                So that: title of notes!SPLIT_TITLE!content of notes\
            ")
            notes = response.text #update global value
            return jsonify({"message":"euge", "notes":notes})
        except sr.UnknownValueError: 
            print("unknown val")
            return jsonify({"message":"euge", "notes":""})

@app.route("/redirectSuccess", methods=["GET", "POST"]) #redirect to success page
def redirectSuccess():
    return render_template("success.html")
    
@app.route("/success", methods=["GET", "POST"]) #if note creation successful...
def success():
    if not request.json:
        print("no request")
        return jsonify({"message":"eheu"})
    elif "data" not in request.json:
        print("no data in json")
        return jsonify({"message":"eheu"})
    else: #send+update with new notes
        global user
        global passw_encoded
        global notesColl

        notesData = request.json["data"]
        notesTitle = notesData[0]
        notesBody = notesData[1]

        notesColl.append([notesTitle, notesBody])
        
        conn = sqlite3.connect("userdata.db")
        cur = conn.cursor()

        cur.execute("UPDATE userdata SET notesCollection = ? WHERE (username, password) = (?, ?)", (json.dumps(notesColl), user, passw_encoded))
        conn.commit()
        conn.close()
        
        return jsonify({"message":"euge"})

@app.route("/redirectDisplay", methods=["GET", "POST"]) #redirect to note display page
def redirectDisplay():
    global noteTitle
    global noteBody
    print(noteTitle, noteBody)
    return render_template("note.html", noteTitle=noteTitle, noteBody=noteBody)

@app.route("/displayNote", methods=["GET", "POST"])  #display notes with information...
def displayNote():
    if not request.json:
        print("no request")
    elif "data" not in request.json:
        print("data not in request")
    else:
        global noteTitle
        global noteBody

        noteInfo = request.json["data"]
        print(noteInfo)
        noteTitle = noteInfo[0]
        noteBody = noteInfo[1]

        return jsonify({"message":"euge"})

@app.route("/renameNote", methods=["GET", "POST"]) #rename notes title
def renameNote():
    if not request.json:
        print("no request")
        return jsonify({"message":"eheu!"})
    elif "data" not in request.json:
        print("no data in request")
        return jsonify({"message":"eheu!"})
    else:
        global noteTitle
        global noteBody
        global notesColl

        newTitle = request.json["data"]

        for i in notesColl:
            if i == [noteTitle, noteBody]:
                i[0] = newTitle
        
        noteTitle = newTitle
        conn = sqlite3.connect("userdata.db")
        cur = conn.cursor()

        cur.execute("UPDATE userdata SET notesCollection = ? WHERE (username, password) = (?, ?)", (json.dumps(notesColl), user, passw_encoded))
        conn.commit()
        conn.close()
        
        return jsonify({"message":"euge"})

@app.route("/editNote", methods=["GET", "POST"]) #edit notes body text
def editNote():
    if not request.json:
        print("no request")
        return jsonify({"message":"eheu!"})
    elif "data" not in request.json:
        print("no data in request")
        return jsonify({"message":"eheu!"})
    else:
        global noteTitle
        global noteBody
        global notesColl

        newNote = request.json["data"]

        for i in notesColl:
            if i == [noteTitle, noteBody]:
                i[1] = newNote
        
        noteBody = newNote
        conn = sqlite3.connect("userdata.db")
        cur = conn.cursor()

        cur.execute("UPDATE userdata SET notesCollection = ? WHERE (username, password) = (?, ?)", (json.dumps(notesColl), user, passw_encoded))
        conn.commit()
        conn.close()
        
        return jsonify({"message":"euge"})
    
@app.route("/deleteNote", methods=["GET", "POST"]) #delete notes...!
def deleteNote():
    global noteTitle
    global noteBody
    global notesColl

    for i in notesColl:
        if i == [noteTitle, noteBody]:
            notesColl.remove(i)

    conn = sqlite3.connect("userdata.db")
    cur = conn.cursor()

    cur.execute("UPDATE userdata SET notesCollection = ? WHERE (username, password) = (?, ?)", (json.dumps(notesColl), user, passw_encoded))
    conn.commit()
    conn.close()
    
    return jsonify({"message":"euge"})

app.run(host="0.0.0.0", port=8080, debug=True)