const mongoose=require("mongoose");
const Schema=mongoose.Schema;
const { type } = require("node:os");

const streakSchema=new Schema({
    userid:{
        type:Schema.Types.ObjectId,
        ref:"User",
    },
    gamification:{
        currentstreak:Number,
        higheststreak:Number,
        lastluxurydate:String,
        totalsavingscore:Number,
        badges:[
            {
                badgeid:String,
                unclokedat:String,
            }]
    },
    
});

const Streak=mongoose.model("Streak",streakSchema);
module.exports=Streak;