const mongoose = require('mongoose');
const { stack } = require('./controllers');
const Schema = mongoose.Schema;

const trade = new Schema({
    type: {type: String},
    symbol: String,
    quantity: Number,
    price: Number
})

const security = new Schema({
    symbol: String,
    avg_buy_price: Number,
    shares: Number
})

const user = new Schema({
    email: {type: String, unique:true, required:true},
    hash: { type: String, required: true },
    firstName: { type: String},
    lastName: { type: String},
    createdDate: { type: Date, default: Date.now },
    portfolio: [security],
    tradeHistory: [trade]
})

user.methods.applyTrade = function(trade) {

    const portfolio = this.portfolio
    const security = portfolio.find(security => security.symbol == trade.symbol)
    if(security) {
        // BUY
        if(trade.type == 'BUY') {
            security.avg_buy_price = (security.avg_buy_price*security.shares + trade.price*trade.quantity) / (security.shares + trade.quantity)
            security.shares = security.shares + trade.quantity
        }
        // SELL
        else if(security.shares >= trade.quantity) {
            security.shares = security.shares - trade.quantity
        }
        //Invalid SELL Trade request
        else {
            throw "Invalid request"
        }
    }
    //if the Security does not exist AND its a BUY trade, create new security in portfolio
    else if (trade.type == 'BUY') {
        console.log("here i am")
        const newsecurity = new mongoose.model('Security')({
            symbol: trade.symbol,
            avg_buy_price: trade.price,
            shares: trade.quantity
        })
        console.log(newsecurity.symbol + " this new boys")
        portfolio.push(newsecurity)
    }
    //send Error when user tries to sell what he doesn't own
    else {
        throw "Invalid request"
    }
    
    this.tradeHistory.push(trade)
}

user.methods.undoLatestTrade = function() {
    const trade = this.tradeHistory.pop()
    const security = this.portfolio.find(security => security.symbol == trade.symbol)

    //undo changes to portfolio
    if (trade.type == 'BUY'){
        security.avg_buy_price = (security.avg_buy_price*security.shares - trade.price*trade.quantity) / (security.shares - trade.quantity)
        security.shares = security.shares - trade.quantity
    }
    else {
        //if it was a SELL Trade, reverting changes is simple
        security.shares = security.shares + trade.quantity
    }
    return trade
}

user.methods.removeTrade = function(tradeid) {
    

    const tradeIndex = this.tradeHistory.findIndex(trade => trade._id == tradeid)
    const security = this.portfolio.find(security => security.symbol == this.tradeHistory[tradeIndex].symbol)

    if(tradeIndex == -1) {
        throw "Trade not found"
    }

    tradesToUndo = this.tradeHistory.length - tradeIndex
    const stack = []

    while(tradesToUndo--){
        stack.push(this.undoLatestTrade())
    }
    //remove trade from database//this action is final
    stack.pop()

    while(stack.length > 0){
        this.applyTrade(stack.pop())
    }

    //Finally, check if the total shares dont go negative
    if(security.shares < 0){
        throw "Invalid request"
    }
}

user.methods.updateTrade = function(tradeid, newtrade){
        

    const tradeIndex = this.tradeHistory.findIndex(trade => trade._id == tradeid)
    const security = this.portfolio.find(security => security.symbol == this.tradeHistory[tradeIndex].symbol)

    if(tradeIndex == -1) {
        throw "Trade not found"
    }

    tradesToUndo = this.tradeHistory.length - tradeIndex
    const stack = []

    while(tradesToUndo--){
        stack.push(this.undoLatestTrade())
    }
    //updating trade in userdata //this action is final
    stack.pop()
    stack.push(newtrade)

    while(stack.length > 0){
        this.applyTrade(stack.pop())
    }

    //Finally, check if the total shares dont go negative
    if(security.shares < 0){
        throw "Invalid request"
    }
}

exports.User = mongoose.model('User', user)
exports.Trade = mongoose.model('Trade', trade)
exports.Security = mongoose.model('Security', security)