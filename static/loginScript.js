function sleep(ms) { //simple wait-type function
    return new Promise(resolve => setTimeout(resolve, ms));
}

function signUp(){ //create user account
    let user = document.getElementById("signUpUser");
    let passw = document.getElementById("signUpPass");
    let errDisplay = document.getElementById("errInfo");

    let validOrNot = validityChecking(user, passw, errDisplay);
    if(validOrNot){
        fetch("/signUp", {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({"data": [user.value, passw.value]})
        })

        .then(response=>{
            if(!response.ok){
                console.log("response not ok");
            }else{
                return response.json();
            }
        })

        .then(data=>{
            if(data.message=="euge"){
                console.log('yippe!!');
                errDisplay.innerText = "Account Created! Redirecting..."
                sleep(2000).then(()=>{
                    window.location.href = data.redirect;
                })
            }else{
                errDisplay.innerText = data.message;
            }
        })

        .catch(err=>{
            errDisplay.innerText = err;
        })
    }
}

function logIn(){ //login to existing account
    let user = document.getElementById("logInUser");
    let passw = document.getElementById("logInPass");
    let errDisplay = document.getElementById("errInfo");

    let validOrNot = validityChecking(user, passw, errDisplay);
    if(validOrNot){
        fetch("/logIn", {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({"data": [user.value, passw.value]})
        })

        .then(response=>{
            if(!response.ok){
                console.log("response not ok");
            }else{
                return response.json();
            }
        })

        .then(data=>{
            if(data.message=="euge"){
                console.log('yippe 2!!');
                errDisplay.innerText = "Login successful! Redirecting..."
                sleep(2000).then(()=>{
                    window.location.href = data.redirect;
                })
            }else{
                errDisplay.innerText = data.message;
            }
        })

        .catch(err=>{
            errDisplay.innerText = err;
        })
    }
}

function validityChecking(user, passw, errDisplay){ //ensure that username/passw lengths = valid
    if(user.value.length < 5){
        errDisplay.innerText = "Username should be at least five characters long!";
        return false;
    }else if(user.value.length > 20){
        errDisplay.innerText = "Username should not exceed 20 characters!";
        return false;
    }else if(passw.value.length < 5){
        errDisplay.innerText = "Password should be at least five characters long!";
        return false;
    }else{
        errDisplay.innerText = "";
        return true;
    }
}