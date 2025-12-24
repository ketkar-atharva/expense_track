const mongoose=require("mongoose");
const { type } = require("node:os");
const Schema=mongoose.Schema;

const expenseSchema=new Schema({
    merchant:String,
    total:Number,
    date:String,
    category:{
        type:String,
        default:"Shopping",
    },
    createdAt:{
        type:Date,
        default:Date.now(),
    },
    isessential:String,
    ownerid:{
        type:Schema.Types.ObjectId,
        ref:"User",
    }

});
const Expense=mongoose.model("expense",expenseSchema);
module.exports=Expense;