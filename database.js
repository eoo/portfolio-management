const mongoose = require('mongoose');
const connectionOptions = { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false };
const uri = "mongodb+srv://admin:STRONGpassword@cluster0.gvlp0.mongodb.net/userDatabase?retryWrites=true&w=majority"

try {
  mongoose.connect(uri, connectionOptions);
} catch (err) {
  console.log(err);
}