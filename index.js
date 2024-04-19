import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport"
import { Strategy } from "passport-local";
import session from "express-session"
import env from "dotenv";

const app=express();
const port=3000;
const saltRounds=10;
env.config();

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        maxAge:1000*60*60*12,
    }
}));
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

const db=new pg.Client({
    user:process.env.DB_USER,
    host:process.env.DB_HOST,
    database:process.env.DB_NAME,
    password:process.env.DB_PASSWORD,
    port:process.env.DB_PORT,
});
db.connect();


let todos=[];
let todoName;



app.get("/",(req,res)=>{
    res.render("home.ejs");
});

app.get("/sign-up",(req,res)=>{
    res.render("register.ejs");
});

app.get("/login",(req,res)=>{
    res.render("login.ejs");
});

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

app.get("/content",async (req,res)=>{
    //console.log(req.user);
    if(req.isAuthenticated()){
        res.render("todo.ejs");
      
    }else{
        res.render("login.ejs");
    }
});

app.get("/view-my-todo",async (req,res)=>{
    //console.log(req.user);
    let todoHeads=[];
    const uId=req.user.id;
    const resultTodo=await db.query("SELECT *FROM todos WHERE uid=$1",[uId]);
    for(let i=0;i<resultTodo.rows.length;i++){
        todoHeads.push(resultTodo.rows[i].todo_title);
    }
    const uniqueTitle=[...new Set(todoHeads)];
    //console.log(uniqueTitle);
    let temp=[{ id: 12, todo_title: 'Daily Plan', todo: 'Morning Walk', uid: 16 }];
    res.render("viewMyTodos.ejs",{titleArr:uniqueTitle});   

    //console.log(todoHeads);
    //console.log(resultTodo.rows[0]);
    
});

app.post("/viewSpecified",async(req,res)=>{
    todoName=req.body.whichTodo;
    const back=req.body.backBtn;
    //console.log(todoName);
    
        const result=await db.query("SELECT *FROM todos WHERE todo_title=$1",[todoName]);
    //console.log(result.rows);
    //console.log(todoName,uId,result.rows);
    res.render("viewMyTodos.ejs",{todos:result.rows,heading:todoName});
    

});

app.post("/post-todo",async(req,res)=>{
    const headVal=req.body.todoHeading;
    const userId=req.user.id; //logged in user id foreign key
    var todosTyped=req.body.inp;
    //console.log(headVal,subVal);
    //console.log(req.user);
   //console.log(todosTyped);
   try{
    for(let i=0;i<todosTyped.length;i++){
        
        await db.query("INSERT INTO todos (todo_title,todo,uid) VALUES($1,$2,$3)",[headVal,todosTyped[i],userId]);
    }
}catch(err){
    console.log("Error in sql,database",err);
}
    
res.redirect("/view-my-todo");
});

app.post("/delete",async(req,res)=>{
    const todoToBeDeleted=req.body.checkVal;
    const currentUser=req.user.id;
    //console.log(currentUser);
    const result=await db.query("DELETE FROM todos WHERE todo=$1 AND uid=$2 RETURNING*;",[todoToBeDeleted,currentUser]);
    const afterDel=await db.query("SELECT *FROM todos  WHERE todo_title=$1",[todoName]);
    if(afterDel.rows.length>0){
    res.render("viewMyTodos.ejs",{todos:afterDel.rows,heading:todoName});
    }
    else{
        res.redirect("/view-my-todo");
    }
    //console.log(afterDel.rows);
});


app.post(
    "/login",
        passport.authenticate("local",{
            successRedirect:"/content",
             failureRedirect:"/login",
}));

app.post("/sign-up",async(req,res)=>{
    const email=req.body.username;
    const password=req.body.password;
    //console.log(email,password);
    try{
    const checkresult=await db.query("SELECT *FROM users WHERE email=$1",[email]);
    if(checkresult.rows.length>0){
        res.redirect("/login");
    }else{
        //hashing password using bcrypt
        bcrypt.hash(password,saltRounds,async(err,hash)=>{
            if(err){
                console.log("Hashing error",err);
            }else{
                //console.log(hash);
                
                    const result=await db.query("INSERT INTO users(email,password) VALUES($1,$2) RETURNING*;",[email,hash]);
                    const user=result.rows[0];
                    req.login(user,(err)=>{
                        console.log("success");
                        res.redirect("/content");
                    });
                    
            }
           
        });

    }
}catch(err){
    console.log("Falied to retrive data from database",err);
}

});




    /*let tempArray=[{id:1,title:"Test1"},{id:2,title:"Test2"}];
res.render("user-content.ejs",{listItems:tempArray,listTitle:"Title"});*/

passport.use("local",new Strategy(async function verify(username,password,cb){
    //console.log(username);
    try{
        const resultFromDb=await db.query("SELECT *FROM users WHERE email=$1",[username]);
        if(resultFromDb.rows.length>0){
            const user=resultFromDb.rows[0];
            const storedHashedPassword=resultFromDb.rows[0].password;
            //matching passwords
            bcrypt.compare(password,storedHashedPassword,(err,result)=>{
                if(err){
                    return cb(err);
                }else{
                    if(result){
                        return cb(null,user); //CORRECT PASSWORD
                    }else{
                        return cb(null,false); //INCORRECT PASSWORD
                    }
                }

            });
        }else{
            return cb("User not found");
        }

    }catch(err){
        console.log("Falied to retrive data from database",err);
    }
}));

passport.serializeUser((user,cb)=>{
    cb(null,user);
});

passport.deserializeUser((user,cb)=>{
    cb(null,user);
});

app.listen(port,()=>{
    console.log(`Server running on ${port}`);
});
