from flask import Flask, render_template, redirect, url_for
import random

app = Flask(__name__)
sessions = dict()

class SWCSession(object):
    def __init__(self):
        self.p1_connected = True
        self.p2_connected = False
        self.p3_connected = False

def generate_token():
    word = ''
    for i in range(10):
        word += random.choice('0123456789abcdefghijklmnoprqstuvwxyz')
    return str(word)

@app.route('/')
def index():
    return render_template(
            'index.html',
            jsfile=url_for(
                'static',
                filename='js/index.js'))

@app.route('/voice')
def voice():
    token = generate_token()
    return redirect('/session/voice/'+token)

@app.route('/video')
def video():
    token = generate_token()
    return redirect('/session/video/'+token)

@app.route('/occupied')
def occupied():
    return 'Room Occupied!'

@app.route('/disconnected/<token>')
def disconnected(token):
    try:
        del(sessions[token])
    except:
        pass
    return 'Remote user disconnected!'

@app.route('/session/<session_type>/<token>')
def session(session_type,token):
    role = None
    try:
        session = sessions[token]
    except:
        session = sessions[token] = SWCSession()
        role = "player1"

    if role is None and session.p2_connected is False:
        session.p2_connected = True
        role = "player2"
    
    if role is None:
        if session.p3_connected is False: 
            session.p2_connected = True
            role = "player3"
        else:
            return redirect('/occupied')

    return render_template(
        session_type+'.html', 
        jsfile=url_for(
            'static',
            filename='js/main.js'),
        token=token, 
        role=role,
        mediaType=session_type)

if __name__ == '__main__':
    app.debug = True
    app.run(port=8080)
