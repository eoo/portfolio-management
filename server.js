const bodyParser = require('body-parser')
const express = require('express')
const db = require('./database.js')
const app = express()

//body-parser
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

//Api routes
app.use('/', require('./controllers'));

app.listen(3000, () => {
    console.log('Server listening on port ' +3000)
})