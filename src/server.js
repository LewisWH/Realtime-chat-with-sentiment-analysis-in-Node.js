require('dotenv').config()
import express from "express"
import configViewEngine from "./configs/viewEngine"
import initWebRoutes from "./routes/web"
import bodyParser from "body-parser"
import cookieParser from 'cookie-parser'
import session from "express-session"
import connectFlash from "connect-flash"
import emojiShortName from 'emoji-short-name'

// Regular expression to match emoji
const regexExp = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/

// express / socket io
let app = express()
let http = require('http')
let server = http.createServer(app)
let io = require('socket.io')(server)

let port = process.env.PORT || 8080
server.listen(port, () => console.log(`Running on port ${port}...`))

// natural nlp
let natural = require('natural')
let Analyzer = natural.SentimentAnalyzer
let stemmer = natural.PorterStemmer
let analyzer = new Analyzer("English", stemmer, "pattern") // 1 > -1

//use cookie parser
app.use(cookieParser('secret'))

//config session
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 // 1 hour
    }
}))

// Enable body parser post data
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

//Config view engine
configViewEngine(app)

//flash
app.use(connectFlash())

// routes
initWebRoutes(app)

// socket io config
let userObj
let usersOnline = []
//on connection
io.on('connection', (socket) => {
  socket.on('join', (username) => {
    const user = {
      id: socket.id,
      username: username
    }
    userObj = user
    usersOnline.push(userObj)
  })
  // on disconnect
  socket.on('disconnect', () => {
    const index = usersOnline.indexOf(userObj)
    if (index != -1) {
      usersOnline.splice(index, 1)
    }
  })
  // emit messages to clients
  socket.on('message', (message) => {
    socket.broadcast.emit('message', message)
    getSentiment(message)
  })
})

// preprocessing / sentiment analysis
async function getSentiment(message) {
  const msgSplit = message.input.split(" ")
  // check / convert emoji to string equivalent
  msgSplit.forEach(function (item, index) {
    if (item.length < 3) {
      if (regexExp.test(item) == true) {
        let checkEmoji = emojiShortName[item]
        if (checkEmoji != 'undefined' && checkEmoji != null) {
          msgSplit[index] = checkEmoji
        }
      }
    }
  })
  message.nsent = await analyzer.getSentiment(msgSplit)
  io.emit('analysis data', message)
}
