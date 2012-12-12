from flask import Flask, render_template, redirect
import tornado.web
from tornado.websocket import WebSocketHandler
from tornado.ioloop import PeriodicCallback,IOLoop
import tornado.wsgi
import random
from threading import Thread
import Queue
import json

class WebRTCClient(object):
    def __init__(self):
        self.queue = Queue.Queue()
        self.connected = False

class WebRTCSession(object):

    def __init__(self):
        self.player1 = WebRTCClient()
        self.player2 = WebRTCClient()

app = Flask(__name__)
sessions = dict()
actions = [ 'register', 'offer', 'answer', 'candidate' ]

def generate_token():
    word = ''
    for i in range(10):
        word += random.choice('0123456789abcdefghijklmnoprqstuvwxyz')
    return str(word)

@app.route('/')
def index():
    token = generate_token()
    return redirect('/session/'+token)

@app.route('/occupied')
def occupied():
    return 'Room Occupied!'

@app.route('/session/<token>')
def session(token):
    role = None
    try:
        session = sessions[token]
    except:
        role = "player1"

    if role is None:
        if session.player2.connected is False:
            role = "player2"
        else:
            return redirect('/occupied')
    return render_template('index.html', token=token, role=role)

class WSHandler(WebSocketHandler):

    def __do_close(self):
        try:
            self.close()
        except:
            print "Already closed"

    def on_message(self, message):
        info = None
        try:
            info = json.loads(message)
            token = info['token']
            role = info['role']
            action = info['action']
        except: 
            print "Malformed JSON object received."
            self.__do_close()
        print "Got Message: token [%s] role [%s] action [%s]." % \
                (token, role, action)

        # If this is a registration, we need to initialize the session
        # before anything else happens.
        if action == 'register':
            return self.__on_register(token, role)

        if role == 'player1':
            remote_client = sessions[token].player2
        elif role == 'player2':
            remote_client = sessions[token].player1
        else:
            print "Unknown Role: "+str(role)
            self.__do_close()

        if action == 'offer':
            offer = info['session_description'] 
            response = { 'action': 'offer', 'offer': offer }
            remote_client.queue.put_nowait(json.dumps(response))

        elif action == 'answer':
            answer = info['session_description']
            response = { 'action': 'answer', 'answer': answer }
            remote_client.queue.put_nowait(json.dumps(response))

        elif action == 'candidate': 
            response = { 
                'action': 'candidate', 
                'label': info['label'], 
                'id': info['id'],
                'candidate': info['candidate'] }
            remote_client.queue.put_nowait(json.dumps(response))

        else:
            print "Unknown Action: "+str(role)

    def __on_register(self, token, role):
        try:
            sessions[token]
        except:
            sessions[token] = WebRTCSession()

        ws_thread = Thread(
            target=getattr(self, role+"_thread"),
            args=(token,))
        ws_thread.start()

    def player1_thread(self, token):
        while True:
            try:
                message = sessions[token].player1.queue.get(True, 0.05)
                self.write_message(message)
            except Queue.Empty:
                pass

    def player2_thread(self, token):
        while True:
            try:
                message = sessions[token].player2.queue.get(True, 0.05)
                self.write_message(message)
            except Queue.Empty:
                pass

if __name__ == '__main__':
    wsgi_app=tornado.wsgi.WSGIContainer(app)
    application=tornado.web.Application([
        (r'/ws',WSHandler),
        (r'.*',tornado.web.FallbackHandler,{'fallback':wsgi_app })])
    application.listen(5000)
    IOLoop.instance().start()
