if(process.env.NODE_ENV !="production"){
    require('dotenv').config()
}
const{ GoogleGenerativeAI}=require("@google/generative-ai");
const prompt=require("prompt-sync");
const express=require("express");
const app=express();
const mongoose=require("mongoose");
const Expense=require('./models/expense');
const User=require("./models/user");
const Streak=require("./models/streak");
const path=require("path");
const methodoverride=require("method-override");
const session=require("express-session");
const Store=session.Store;
const passport=require("passport");
const flash=require("connect-flash");
const ejsmate=require("ejs-mate");
const multer=require("multer");
const fs=require("fs");
const axios=require("axios");
let {storage}=require("./cloudConfig");
const upload=multer({storage});


app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodoverride("_method"));
app.engine("ejs",ejsmate);
app.use(express.static(path.join(__dirname,"public")));

const sessionSchema=new mongoose.Schema({
  _id:String,
  session:Object,
  expires:Date,
});
const Session= mongoose.model("Session",sessionSchema);

sessionSchema.index({expires:1},{expireAfterSeconds:0});
const dbURL=process.env.ATLAS_URL;

// Database Connectivity
main().then(()=>{
  console.log("Connected to database");
}).catch((err)=>{console.log(err)});


async function main(){
  await mongoose.connect(dbURL,{
    useNewUrlParser: true,
  useUnifiedTopology: true,
  }).then(()=>console.log("Mongostore connect")).catch((err)=>console.log("Mongostore err:",err));

};

class MongooseStore extends Store {
  constructor(options={}) {
    super();
    this.ttl = options.ttl || 30 * 24 * 60 * 60;
  }

  async get(sid, callback) {
    try {
      const doc = await Session.findById(sid);
      callback(null, doc ? doc.session : null);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid, sessionData, callback) {
    try {
      await Session.findByIdAndUpdate(
        sid,
        { session: sessionData, expires: sessionData.cookie?.expires },
        { upsert: true }
      );
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await Session.findByIdAndDelete(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

    async touch(sid, sessionData, callback) {
    try {
      const expires =
        sessionData.cookie?.expires ||
        new Date(Date.now() + this.ttl * 1000);

      await Session.findByIdAndUpdate(
        sid,
        { expires },
        { new: false }
      );

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

};


//Session Passport & Falsh Message middleware
const sessionOptions={
  secret:process.env.SECRET,
  resave:false,
  saveUninitialized:false,
  store:new MongooseStore({ttl:30*24*60*60}),
  cookie:{
    expires:Date.now()+7*24*60*60*1000,
    maxAge:30*24*60*60*1000,
    httpOnly:true,
  }
}

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
  res.locals.successMsg=req.flash("success");
  res.locals.errorMsg=req.flash("error");
  res.locals.warningMsg=req.flash("warning");
  res.locals.currUser=req.user;
  
  next();
})

//gemini ai veriable
const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

//INITIALIZE GEMINI API
async function run(){
    const model=genAI.getGenerativeModel({model:"gemini-2.5-flash-lite"});
    const prompt="Write a 1-sentence welcome message for a new expense tracking app.";
    
    try{
        const result=await model.generateContent(prompt);
        const response=await result.response;
        const text=response.text();
        console.log("Gemini says:",text);
    }catch(err){
        console.log(err);
    }
    
}


//Helper function

function fileToGenerativePart(path, mimeType) {
 // 1. Check if the mimeType is generic 'octet-stream'
  // If it is, try to guess it from the file extension or force it to 'image/jpeg'
  let finalMimeType = mimeType;
  
  if (mimeType === "application/octet-stream") {
    if (path.endsWith(".png")) finalMimeType = "image/png";
    else if (path.endsWith(".webp")) finalMimeType = "image/webp";
    else finalMimeType = "image/jpeg"; // Default fallback for receipts
  }

  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType: finalMimeType // Use the corrected type here
    },
  };
}



//Root
app.get("/aboutus",(req,res)=>{
  res.render("trial/aboutus");
})

//Signup
app.get("/signup",(req,res,next)=>{
  res.render("trial/signup");
})
app.post("/signup",async(req,res)=>{
 try{
   let {username,email,password,budget}=req.body;
  console.log(req.body);
  const newuser=new User({email,username});
  newuser.budget=budget;
  const registered=await User.register(newuser,password);
  console.log(registered);
  let newstreak=new Streak({
    userid:registered._id,
    gamification:{
      currentstreak:0,
      higheststreak:0,
      lastluxurydate:"",
      totalsavingscore:0,
      badges:[
        {
          badgeid:"Rookie",
          unclokedat:String(new Date().toISOString()),
        }
      ],
    },
    
  });
  await newstreak.save();
  res.redirect("/login");
 }catch(err){
    req.flash("error",err.message);
    res.redirect("/signup");
 }
});

//Login 
app.get("/login",(req,res)=>{
  res.render("trial/login");

});

app.post("/login",passport.authenticate("local",{failureRedirect:"/login",failureFlash:true}),(req,res)=>{
  console.log(req.user.username);
  res.redirect("/home");
});
//Logout
app.get("/logout",(req,res)=>{
  req.logOut((err)=>{
    if(err){
      next(err);
    }
    req.flash("success","You have Logged Out");
    res.redirect("/login");
  })
})

//Home api
app.get("/home", async (req,res)=>{
  if(!req.isAuthenticated()){
    req.flash("error","You must be logged in");
    return res.redirect("/login");
  }
  checkBadge(req.user._id);
  uncheckBadge(req.user._id);
  const expdetails=await Expense.find({ownerid:req.user._id});
  const badge=await Streak.findOne({userid:req.user._id});
  const currs=badge.gamification.currentstreak;
  
  const badgeName="Week_warrior";
  const hasBadge = (badgeName) => {
        return badge.gamification.badges.some(b => b.badgeid === badgeName);
    };
  res.render("trial/home",{hasBadge,currs,expdetails});
});

//All Expenses api
app.get("/allexp",async(req,res)=>{
  let id=req.user._id;
  const allexp=await Expense.find({ownerid:id});
  res.render("trial/allexp",{allexp});
})

//Search 
app.get("/search",(req,res)=>{
  if(!req.isAuthenticated()){
    req.flash("error","You must be logged in");
    return res.redirect("/login");
  }
    
    res.render("trial/addexp");
})

app.post("/search",async(req,res)=>{
   let newexpn=new Expense(req.body.exp);
   newexpn.ownerid=req.user._id;
   await newexpn.save();
   let id=req.user._id;
   console.log(id);
   const isuser= await Streak.findOne({userid:id});
   if(!isuser){
    req.flash("error","User Not Identified");
    return res.redirect("/login");
   };
 const wasLuxury = String(req.body.exp.isessential).toLowerCase() === "false";

const update = {
  $inc: {},
  $set: {}
};

if (wasLuxury) {
  if(isuser.gamification.currentstreak!=0){
  update.$inc["gamification.currentstreak"] = -1;
  }
  update.$set["gamification.lastluxurydate"] = new Date().toISOString();
} else {
  update.$inc["gamification.currentstreak"] = 1;
  update.$inc["gamification.totalsavingscore"] = 10;
}

await Streak.updateOne({ userid: id }, update);
req.flash("success","Expense Added");
checkBadge(id);


res.redirect("/search");

    
});

//Badge Logic Function
const checkBadge=async(userId)=>{
    const streak=await Streak.findOne({userid:userId});
    const {currentstreak,totalsavingscore}=streak.gamification;
    const currBadge=streak.gamification.badges.map(b=>b.badgeid);
    let badgeReward=null;
    if(currentstreak>=7 && !currBadge.includes("Week_warrior")){
      badgeReward={badgeid:"Week_warrior",unclokedat:String(new Date().toISOString())};
    }else if(totalsavingscore>=500 && !currBadge.includes("Savings_sensei")){
      badgeReward={badgeid:"Savings_sensei",unclokedat:String(new Date().toISOString())};
    }else if(currentstreak>=14 && !currBadge.includes("Frugal_flyer")){
      badgeReward={badgeid:"Frugal_flyer",unclokedat:String(new Date().toISOString())};
    };
    if(badgeReward){
      await Streak.updateOne({userid:userId},{$push:{"gamification.badges":badgeReward}});

    }

    
};
const uncheckBadge=async(userId)=>{
    const streak=await Streak.findOne({userid:userId});
    const {currentstreak,totalsavingscore}=streak.gamification;
    const currBadge=streak.gamification.badges.map(b=>b.badgeid);
    if (currentstreak < 7 && currBadge.includes("Week_warrior")) {
        await Streak.updateOne({ userid: userId }, { $pull: { "gamification.badges": { badgeid: "Week_warrior" } } });
    }

    if (totalsavingscore < 500 && currBadge.includes("Savings_sensei")) {
        await Streak.updateOne({ userid: userId }, { $pull: { "gamification.badges": { badgeid: "Savings_sensei" } } });
    }

    if (currentstreak < 14 && currBadge.includes("Frugal_flyer")) {
        await Streak.updateOne({ userid: userId }, { $pull: { "gamification.badges": { badgeid: "Frugal_flyer" } } });
    }
}


//Scanning the bill/receipt
app.get("/scan",(req,res)=>{
   if(!req.isAuthenticated()){
    req.flash("error","You must be Logged in");
   return res.redirect("/login");
  }
    res.render("trial/billpic");
})
app.post("/scan-receipt", upload.single("receipt"), async (req, res) => {
 
  if (!req.file) {
    return res.status(400).send("No receipt image uploaded.");
  }

  try {
    let id=req.user._id;
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // // Prepare the image part

    const imageUrl = req.file.path;

// Explicit transformation
      const jpgUrl = imageUrl.replace(
        "/upload/",
        "/upload/f_jpg,q_auto/"
      );

      const imageResponse = await axios.get(jpgUrl, { responseType: 'arraybuffer' });
      const base64Data = Buffer.from(imageResponse.data).toString('base64');

      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      };

    const essential=req.body.text;
    // The Prompt: Be very specific about the JSON structure
    const prompt = `
      Look at this receipt image. 
      Extract the following information and return it ONLY as a JSON object:
      {
        "merchant": "Name of the store/restaurant",
        "total": "Total amount spent as a number",
        "date": "Date of transaction",
        "category": "One of: Food, Travel, Shopping, or Bills"
      }
    `;


const result = await model.generateContent([prompt, imagePart]);
const response = await result.response;
const text = response.text();


    const cleanedJson = text.replace(/```json|```/g, "").trim();
    const data=JSON.parse(cleanedJson);
    const newexpense=new Expense({
      merchant:data.merchant,
      total:data.total,
      date:data.date,
      category:data.category,
      isessential:essential,
      ownerid:req.user._id
    });
    await newexpense.save();
    const isuser= await Streak.findOne({userid:id});
   
   if(!isuser){
    req.flash("error","User Not Identified");
    return res.redirect("/login");
   };
 const wasLuxury = String(essential).toLowerCase() === "false";

const update = {
  $inc: {},
  $set: {}
};

if (wasLuxury) {
  if(isuser.gamification.currentstreak!=0){
  update.$inc["gamification.currentstreak"] = -1;
  }
  update.$set["gamification.lastluxurydate"] = new Date().toISOString();
} else {
  update.$inc["gamification.currentstreak"] = 1;
  update.$inc["gamification.totalsavingscore"] = 10;
}

await Streak.updateOne({ userid: id }, update);
checkBadge(id);
    req.flash("success","Receipt Saved succesfully");
    res.redirect("/scan");



  } catch (err) {
    console.error("Scanning Error:", err);
    res.status(500).send("Failed to analyze receipt.");
  }
});


app.listen(3000,()=>{
    console.log("server is listening");
})