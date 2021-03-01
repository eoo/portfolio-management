const mongoose = require('mongoose')
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

exports.User = mongoose.model('User', user)
exports.Trade = mongoose.model('Trade', trade)
exports.Security = mongoose.model('Security', security)