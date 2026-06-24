"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const generative_ai_1 = require("@google/generative-ai");
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const methodOverride = require("method-override");
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const connect_flash_1 = __importDefault(require("connect-flash"));
const ejsMate = require("ejs-mate");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const cloudConfig_1 = require("./cloudConfig");
const expense_1 = __importDefault(require("./models/expense"));
const user_1 = __importDefault(require("./models/user"));
const streak_1 = __importDefault(require("./models/streak"));
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ storage: cloudConfig_1.storage });
app.set("view engine", "ejs");
app.set("views", path_1.default.join(__dirname, "views"));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
const sessionSchema = new mongoose_1.default.Schema({
    _id: String,
    session: Object,
    expires: Date,
});
const Session = mongoose_1.default.model("Session", sessionSchema);
sessionSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
const dbURL = process.env.ATLAS_URL || "";
// Database Connectivity
main().then(() => {
    console.log("Connected to database");
}).catch((err) => { console.log(err); });
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(dbURL, {
        // useNewUrlParser: true, // Deprecated in newer mongoose
        // useUnifiedTopology: true, // Deprecated in newer mongoose
        }).then(() => console.log("Mongostore connect")).catch((err) => console.log("Mongostore err:", err));
    });
}
;
class MongooseStore extends express_session_1.default.Store {
    constructor(options = {}) {
        super();
        this.ttl = options.ttl || 30 * 24 * 60 * 60;
    }
    get(sid, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const doc = yield Session.findById(sid);
                callback(null, doc ? doc.session : null);
            }
            catch (err) {
                callback(err);
            }
        });
    }
    set(sid, sessionData, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                yield Session.findByIdAndUpdate(sid, { session: sessionData, expires: (_a = sessionData.cookie) === null || _a === void 0 ? void 0 : _a.expires }, { upsert: true });
                callback(null);
            }
            catch (err) {
                callback(err);
            }
        });
    }
    destroy(sid, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Session.findByIdAndDelete(sid);
                callback(null);
            }
            catch (err) {
                callback(err);
            }
        });
    }
    touch(sid, sessionData, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const expires = ((_a = sessionData.cookie) === null || _a === void 0 ? void 0 : _a.expires) ||
                    new Date(Date.now() + this.ttl * 1000);
                yield Session.findByIdAndUpdate(sid, { expires }, { new: false });
                callback(null);
            }
            catch (err) {
                callback(err);
            }
        });
    }
}
;
//Session Passport & Flash Message middleware
const sessionOptions = {
    secret: process.env.SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: new MongooseStore({ ttl: 30 * 24 * 60 * 60 }),
    cookie: {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
};
app.use((0, express_session_1.default)(sessionOptions));
app.use((0, connect_flash_1.default)());
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Passport configuration
passport_1.default.use(user_1.default.createStrategy());
passport_1.default.serializeUser(user_1.default.serializeUser());
passport_1.default.deserializeUser(user_1.default.deserializeUser());
app.use((req, res, next) => {
    res.locals.successMsg = req.flash("success");
    res.locals.errorMsg = req.flash("error");
    res.locals.warningMsg = req.flash("warning");
    res.locals.currUser = req.user;
    next();
});
//gemini ai veriable
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
//INITIALIZE GEMINI API
// This function seemed unused in app.js or simply just a test function? 
// It was called 'run' but never called in 'app.js'. I will keep it.
function runGenAI() {
    return __awaiter(this, void 0, void 0, function* () {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        const prompt = "Write a 1-sentence welcome message for a new expense tracking app.";
        try {
            const result = yield model.generateContent(prompt);
            const response = yield result.response;
            const text = response.text();
            console.log("Gemini says:", text);
        }
        catch (err) {
            console.log(err);
        }
    });
}
//Helper function
// This seems unused or implicitly used. Keeping it.
function fileToGenerativePart(path, mimeType) {
    // 1. Check if the mimeType is generic 'octet-stream'
    // If it is, try to guess it from the file extension or force it to 'image/jpeg'
    let finalMimeType = mimeType;
    if (mimeType === "application/octet-stream") {
        if (path.endsWith(".png"))
            finalMimeType = "image/png";
        else if (path.endsWith(".webp"))
            finalMimeType = "image/webp";
        else
            finalMimeType = "image/jpeg"; // Default fallback for receipts
    }
    return {
        inlineData: {
            data: Buffer.from(fs_1.default.readFileSync(path)).toString("base64"),
            mimeType: finalMimeType // Use the corrected type here
        },
    };
}
//Root
app.get("/aboutus", (req, res) => {
    res.render("trial/aboutus");
});
//Signup
app.get("/signup", (req, res, next) => {
    res.render("trial/signup");
});
app.post("/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let { username, email, password, budget } = req.body;
        console.log(req.body);
        const newuser = new user_1.default({ email, username });
        newuser.budget = budget; // budget is not in IUser interface but seemingly used
        const registered = yield user_1.default.register(newuser, password);
        console.log(registered);
        let newstreak = new streak_1.default({
            userid: registered._id,
            gamification: {
                currentstreak: 0,
                higheststreak: 0,
                lastluxurydate: "",
                totalsavingscore: 0,
                badges: [
                    {
                        badgeid: "Rookie",
                        unclokedat: String(new Date().toISOString()),
                    }
                ],
            },
        });
        yield newstreak.save();
        res.redirect("/login");
    }
    catch (err) {
        req.flash("error", err.message);
        res.redirect("/signup");
    }
}));
//Login 
app.get("/login", (req, res) => {
    res.render("trial/login");
});
app.post("/login", passport_1.default.authenticate("local", { failureRedirect: "/login", failureFlash: true }), (req, res) => {
    var _a;
    console.log((_a = req.user) === null || _a === void 0 ? void 0 : _a.username);
    res.redirect("/home");
});
//Logout
app.get("/logout", (req, res, next) => {
    req.logOut((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You have Logged Out");
        res.redirect("/login");
    });
});
//Home api
app.get("/home", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be logged in");
        return res.redirect("/login");
    }
    const user = req.user;
    checkBadge(user._id);
    uncheckBadge(user._id);
    const expdetails = yield expense_1.default.find({ ownerid: user._id });
    const badge = yield streak_1.default.findOne({ userid: user._id });
    if (!badge) {
        // Handle case where streak/badge is missing
        return res.redirect("/login");
    }
    const currs = badge.gamification.currentstreak;
    const badgeName = "Week_warrior";
    const hasBadge = (badgeName) => {
        return badge.gamification.badges.some(b => b.badgeid === badgeName);
    };
    res.render("trial/home", { hasBadge, currs, expdetails });
}));
//All Expenses api
app.get("/allexp", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be logged in");
        return res.redirect("/login");
    }
    let id = req.user._id;
    const allexp = yield expense_1.default.find({ ownerid: id });
    res.render("trial/allexp", { allexp });
}));
//Search 
app.get("/search", (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be logged in");
        return res.redirect("/login");
    }
    res.render("trial/addexp");
});
app.post("/search", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let newexpn = new expense_1.default(req.body.exp);
    newexpn.ownerid = req.user._id;
    yield newexpn.save();
    let id = req.user._id;
    console.log(id);
    const isuser = yield streak_1.default.findOne({ userid: id });
    if (!isuser) {
        req.flash("error", "User Not Identified");
        return res.redirect("/login");
    }
    ;
    const wasLuxury = String(req.body.exp.isessential).toLowerCase() === "false";
    const update = {
        $inc: {},
        $set: {}
    };
    if (wasLuxury) {
        if (isuser.gamification.currentstreak != 0) {
            update.$inc["gamification.currentstreak"] = -1;
        }
        update.$set["gamification.lastluxurydate"] = new Date().toISOString();
    }
    else {
        update.$inc["gamification.currentstreak"] = 1;
        update.$inc["gamification.totalsavingscore"] = 10;
    }
    yield streak_1.default.updateOne({ userid: id }, update);
    req.flash("success", "Expense Added");
    checkBadge(id);
    res.redirect("/search");
}));
//Badge Logic Function
const checkBadge = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const streak = yield streak_1.default.findOne({ userid: userId });
    if (!streak)
        return;
    const { currentstreak, totalsavingscore } = streak.gamification;
    const currBadge = streak.gamification.badges.map(b => b.badgeid);
    let badgeReward = null;
    if (currentstreak >= 7 && !currBadge.includes("Week_warrior")) {
        badgeReward = { badgeid: "Week_warrior", unclokedat: String(new Date().toISOString()) };
    }
    else if (totalsavingscore >= 500 && !currBadge.includes("Savings_sensei")) {
        badgeReward = { badgeid: "Savings_sensei", unclokedat: String(new Date().toISOString()) };
    }
    else if (currentstreak >= 14 && !currBadge.includes("Frugal_flyer")) {
        badgeReward = { badgeid: "Frugal_flyer", unclokedat: String(new Date().toISOString()) };
    }
    ;
    if (badgeReward) {
        yield streak_1.default.updateOne({ userid: userId }, { $push: { "gamification.badges": badgeReward } });
    }
});
const uncheckBadge = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const streak = yield streak_1.default.findOne({ userid: userId });
    if (!streak)
        return;
    const { currentstreak, totalsavingscore } = streak.gamification;
    const currBadge = streak.gamification.badges.map(b => b.badgeid);
    if (currentstreak < 7 && currBadge.includes("Week_warrior")) {
        yield streak_1.default.updateOne({ userid: userId }, { $pull: { "gamification.badges": { badgeid: "Week_warrior" } } });
    }
    if (totalsavingscore < 500 && currBadge.includes("Savings_sensei")) {
        yield streak_1.default.updateOne({ userid: userId }, { $pull: { "gamification.badges": { badgeid: "Savings_sensei" } } });
    }
    if (currentstreak < 14 && currBadge.includes("Frugal_flyer")) {
        yield streak_1.default.updateOne({ userid: userId }, { $pull: { "gamification.badges": { badgeid: "Frugal_flyer" } } });
    }
});
//Scanning the bill/receipt
app.get("/scan", (req, res) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be Logged in");
        return res.redirect("/login");
    }
    res.render("trial/billpic");
});
app.post("/scan-receipt", upload.single("receipt"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        return res.status(400).send("No receipt image uploaded.");
    }
    try {
        let id = req.user._id;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
        // // Prepare the image part
        const imageUrl = req.file.path;
        // Explicit transformation
        const jpgUrl = imageUrl.replace("/upload/", "/upload/f_jpg,q_auto/");
        const imageResponse = yield axios_1.default.get(jpgUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(imageResponse.data).toString('base64');
        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg"
            }
        };
        const essential = req.body.text;
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
        const result = yield model.generateContent([prompt, imagePart]);
        const response = yield result.response;
        const text = response.text();
        const cleanedJson = text.replace(/```json|```/g, "").trim();
        const data = JSON.parse(cleanedJson);
        const newexpense = new expense_1.default({
            merchant: data.merchant,
            total: data.total,
            date: data.date,
            category: data.category,
            isessential: essential,
            ownerid: req.user._id
        });
        yield newexpense.save();
        const isuser = yield streak_1.default.findOne({ userid: id });
        if (!isuser) {
            req.flash("error", "User Not Identified");
            return res.redirect("/login");
        }
        ;
        const wasLuxury = String(essential).toLowerCase() === "false";
        const update = {
            $inc: {},
            $set: {}
        };
        if (wasLuxury) {
            if (isuser.gamification.currentstreak != 0) {
                update.$inc["gamification.currentstreak"] = -1;
            }
            update.$set["gamification.lastluxurydate"] = new Date().toISOString();
        }
        else {
            update.$inc["gamification.currentstreak"] = 1;
            update.$inc["gamification.totalsavingscore"] = 10;
        }
        yield streak_1.default.updateOne({ userid: id }, update);
        checkBadge(id);
        req.flash("success", "Receipt Saved succesfully");
        res.redirect("/scan");
    }
    catch (err) {
        console.error("Scanning Error:", err);
        res.status(500).send("Failed to analyze receipt.");
    }
}));
app.listen(3000, () => {
    console.log("server is listening");
});
