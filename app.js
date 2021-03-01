const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const express = require('express')
const {User, Trade, Security} = require('./modals')

const app = express()

//connect to database
const uri = "mongodb+srv://admin:STRONGpassword@cluster0.gvlp0.mongodb.net/userDatabase?retryWrites=true&w=majority"
mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology: true})

//body-parser
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/portfolio', verifyToken, async (request, response) => {
    const user = await User.findOne({_id: request.userid})
    response.status(200).json({portfolio: user.portfolio})
})

app.get('/trades', verifyToken, async (request, response) => {
    const user = await User.findOne({_id: request.userid})
    response.status(200).json({tradeHistory: user.tradeHistory})
})

app.post('/signin', async (request, response) => {
    
    const user = await User.findOne({ email: request.body.email })

    if (user && bcrypt.compareSync(request.body.password, user.hash)) {
        const token = jwt.sign({ userid: user.id }, 'secretkey', { expiresIn: '7d' })
        
        response.json({
            name: user.firstName + user.lastName,
            token: token,
            message: "Login successful"
        })
    }
})

app.post('/signup', async (request, response) => {

    const user = new User(request.body)
    user.hash = bcrypt.hashSync(request.body.password, 10)
    await user.save()
    response.status(201).send("Created")
})

app.post('/trades', verifyToken, async (request, response) => {

    const trade = new Trade(request.body)
    const user = await User.findOne({_id: request.userid})

    //process new trade request
    user.tradeHistory.push(trade)
    const portfolio = user.portfolio
    var alreadyPresent = false
    
    for(security of portfolio){
        if(security.symbol == trade.symbol) {
            alreadyPresent = true
            if(trade.type == 'BUY') {
                security.avg_buy_price = (security.avg_buy_price*security.shares + trade.price*trade.quantity) / (security.shares + trade.quantity)
                security.shares = security.shares + trade.quantity
                await user.save()
                response.status(200).json({
                    message: "Success: Bought"
                })
            }
            else if(trade.type == 'SELL') {
                if (trade.quantity > security.shares) {
                    response.status(400).json({
                        message: "Inavid input: Cannot sell the shares i dont have"
                    })
                }
                else {
                    security.shares = security.shares - trade.quantity
                    const returns = trade.quantity * (trade.price - security.avg_buy_price)
                    await user.save()
                    response.status(200).json({
                        message: "Success : Sold",
                        returns
                    })
                }
            }
        }
    }

    if(!alreadyPresent && trade.type == 'BUY') {
        //create new security in user portfolio
        const security = new Security({
            symbol: trade.symbol,
            avg_buy_price: trade.price,
            shares: trade.quantity
        })
        portfolio.push(security)
        await user.save()

        response.status(200).json({
            message: "Success: new Security added to portfolio"
        })
    }
    else if (!alreadyPresent && trade.type == "SELL") {
        console.log("invalid request")
        response.status(400).json({
            message: "Inavid input: Cannot sell the shares i dont have"
        })
    }
})

app.delete('/trades/:id', verifyToken, async (request, response) => {

    const user = await User.findOne({_id: request.userid})
    const tradeIndex = user.tradeHistory.findIndex(trade => trade._id == request.params.id)
    const trade = user.tradeHistory[tradeIndex]
    const security = user.portfolio.find(security => security.symbol == trade.symbol)
    //verify trade delete request
    if(tradeIndex > -1){
        if (trade.type == "BUY" ){
            if(security.shares >= trade.quantity){
                //process delete request
                security.avg_buy_price = (security.avg_buy_price*security.shares - trade.price*trade.quantity) / (security.shares - trade.quantity)
                security.shares = security.shares - trade.quantity
            }
            else { 
                response.json({message: "Fail - Not enough shares in portfolio to undo BUY"})
            }
        }
        else {
            //if the trade type was SELL
            security.shares = security.shares + trade.quantity
        }
        //And finally remove the trade from user's trade history
        user.tradeHistory.splice(tradeIndex, 1)
        await user.save()
        response.status(200).json({message: "Deleted"})
    }
    else {
        response.json({message: "Invalid trade ID"})
    }
})



function verifyToken(request, response, next) {

    const bearerToken = request.headers['authorization'].split(' ')[1]
    if(typeof bearerToken == undefined) {
        return response.status(403).json({message: "Token not provided"})
    } else {
        request.token = bearerToken;
        jwt.verify(request.token, 'secretkey', (err, {userid}) => {
            if(err) return response.status(403).json({message: "Invalid Token"})
            request.userid = userid
            next()
        })
    }
}

app.listen(4000)