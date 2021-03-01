const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const express = require('express')
const router = express.Router()
const {User, Trade, Security} = require('./modals')

//routes
router.post('/signin', signin)
router.post('/signup', signup)

router.get('/portfolio', verifyToken, getPortfolio)
router.get('/trades', verifyToken, getTrades)
router.get('/portfolio/returns', verifyToken, getReturns)
router.post('/trades', verifyToken, addTrade)
router.delete('/trades/:id', verifyToken, deleteTrade)

module.exports = router

//handlers
async function signin(request, response) {
    const user = await User.findOne({ email: request.body.email })

    if (user && bcrypt.compareSync(request.body.password, user.hash)) {
        const token = jwt.sign({ userid: user.id }, 'secretkey', { expiresIn: '7d' })
        
        response.json({
            name: user.firstName + user.lastName,
            token: token,
            message: "Login successful"
        })
    }
}

async function signup(request, response) {
    const user = new User(request.body)
    user.hash = bcrypt.hashSync(request.body.password, 10)
    await user.save()
    response.status(201).send("Created")
}

async function getPortfolio(request, response) {
    const user = await User.findOne({_id: request.userid})
    response.status(200).json({portfolio: user.portfolio})
}

async function getTrades(request, response) {
    const user = await User.findOne({_id: request.userid})
    response.status(200).json({tradeHistory: user.tradeHistory})
}

async function getReturns(request, response) {
    const user = await User.findOne({_id: request.userid})
    var returns = 0;
    
    user.portfolio.forEach(element => {
        returns += (100 - element.avg_buy_price)*element.shares
    });
    response.status(200).json({returns})
}

async function addTrade(request, response) {

    const trade = new Trade(request.body)
    const user = await User.findOne({_id: request.userid})

    //process new trade request
    user.tradeHistory.push(trade)
    const portfolio = user.portfolio
    
    //get the security for which the trade applies
    const security = portfolio.find(security => security.symbol == trade.symbol)
    
    //if the Security exists in the user's portfolio, update the Security with new Trade
    if(security) {
        // BUY
        if(trade.type == 'BUY') {
            security.avg_buy_price = (security.avg_buy_price*security.shares + trade.price*trade.quantity) / (security.shares + trade.quantity)
            security.shares = security.shares + trade.quantity
            await user.save()
            response.status(200).json({
                message: "Success: Bought"
            })
        }
        // SELL
        else if(security.shares >= trade.quantity) {
            security.shares = security.shares - trade.quantity
            const returns = trade.quantity * (trade.price - security.avg_buy_price)
            await user.save()
            response.status(200).json({
                message: "Success : Sold",
                returns
            })
        }
        //Invalid SELL Trade request
        else {
            response.status(400).json({
                message: "Invalid SELL request: Cannot sell the shares I dont have"
            })
        }
    }
    //if the Security does not exist and its a BUY trade, create new security in portfolio
    else if (trade.type == 'BUY') {
        const security = new Security({
            symbol: trade.symbol,
            avg_buy_price: trade.price,
            shares: trade.quantity
        })
        portfolio.push(security)
        await user.save()
        response.status(200).json({
            message: "new Security sucessfully added to portfolio"
        })
    }
    //send Error when user tries to sell what he doesn't own
    else {
        console.log("Invalid addTrade request")
        response.status(400).json({
            message: "Invalid SELL request: Cannot sell the shares I dont have"
        })
    }
}

async function deleteTrade(request, response) {

    const user = await User.findOne({_id: request.userid})
    
    //search for the Trade in user's trade history
    const tradeIndex = user.tradeHistory.findIndex(trade => trade._id == request.params.id)
    //return immediately if Trade not found
    if(tradeIndex == -1) return response.json({message: "Invalid trade ID"})
    //else get the trade
    const trade = user.tradeHistory[tradeIndex]

    //get the corresponding Security
    const security = user.portfolio.find(security => security.symbol == trade.symbol)

    //verify and process Trade delete request
    if (trade.type == "BUY" ){
        if(security.shares >= trade.quantity){
            //revert changes to portfolio
            security.avg_buy_price = (security.avg_buy_price*security.shares - trade.price*trade.quantity) / (security.shares - trade.quantity)
            security.shares = security.shares - trade.quantity
        }
        else { 
            return response.json({message: "Error: Not enough shares in portfolio to undo BUY"})
        }
    }
    else {
        //if it was a SELL Trade, reverting changes is simple
        security.shares = security.shares + trade.quantity
    }
    //And finally remove the trade from user's trade history
    user.tradeHistory.splice(tradeIndex, 1)
    await user.save()
    response.status(200).json({message: "Deleted"})
}

// Helpers/Middleware

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
