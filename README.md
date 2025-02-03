As someone with ADHD, focus has (understandably) never been my strong suit. My brain seems to turn itself off in the classroom completely, like it refuses to retain any of the information no matter how much I internally yell at it. This makes learning new content VERY DIFFICULT for me. Especially taking notes. 

Almost every teacher expects students to take notes in their class, which is fine if you're capable of doing it. I'm not. And I realize that it's not just me facing this problem. From neurological to physical, there are so many different conditions that can affect a student's learning-- things like lack of focus, poor hearing, motor function issues can make it almost impossible to take notes. No student should have to struggle this much in their learning journey.

# Solution: Apollo!!
Apollo is a flask app that allows users to turn live teacher lectures into notes with the click of a button. Users will be able to run the program while the teacher is talking, and it will automatically convert everything into virtual notes that can be used for studying and review. Can't focus? Physically struggle to write (or type)? Can't hear the teacher well? Let Apollo handle it for you.

## Features
- Working sign up/login system to save all notes
- Live audio to readable notes (updates dynamically-- see it as it happens!)
- Options to edit notes/delete unnecessary ones

## Tech Stack
Frontend:
- HTML5
- CSS3
- Plain JS

Backend:
- Flask
    - Sqlite3
    - SpeechRecognition
    - GeminiAPI

## What's next?
Here's a list of some features I would love to implement in the future:
- Better customization: Potential color modes (light/dark? colorschemes?)
- Organization: Drag to change position of notes, group notes together based on subject
- Practice: Practice feature similar to Gimkit/Blooket
