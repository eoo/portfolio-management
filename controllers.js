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
router.put('/trades/:id', verifyToken, updateTrade)

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
    const user = await User.findOne({_id: request.userid})
    const trade = new Trade(request.body)

    try{
        user.applyTrade(trade)
        await user.save()

        response.status(200).json({message: "Success."})
    } catch(error) {
        response.status(400).json({message: error})
    }
}

async function deleteTrade(request, response) {
    const user = await User.findOne({_id: request.userid})

    try{    
        user.removeTrade(request.params.id)
        await user.save()
        response.status(200).json({message: "Success."})
    } catch(error) {
        response.status(400).json({message: error})
    }
}

async function updateTrade(request, response) {
    const user = await User.findOne({_id: request.userid})
    const trade = new Trade(request.body)

    try{    
        user.updateTrade(request.params.id, trade)
        await user.save()
        response.status(200).json({message: "Success."})
    } catch(error) {
        response.status(400).json({message: error})
    }
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