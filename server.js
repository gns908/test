require('dotenv').config()

const express = require('express')
const app = express()
const port = process.env.PORT

app.set('view engine', 'ejs')
app.use(express.static('public'))

app.use(express.json())
app.use(express.urlencoded({extended:true}))

const { MongoClient } = require('mongodb')
const uri = process.env.MONGO_URL;
const client = new MongoClient(uri)

const fs = require('fs')
const uploadDir = 'public/uploads/'

const multer = require('multer');
const path = require('path');

// methodOverride
const methodOverride = require('method-override')
app.use(methodOverride('_method'))

//부모 디렉토리가 존재하지 않을 경우, 상위 디렉토리도 함께 생성할 수 있도록 설정
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const getDB = async ()=>{
   await client.connect()
   return client.db('blog')
}


app.get('/', async (req, res)=>{
    try{
        const db = await getDB()
        const posts = await db.collection('posts').find().toArray()
        console.log(posts);
        res.render('index', {posts})
    }catch(e){
        console.error(e);
    }
})


app.get('/write', (req, res)=>{
    res.render('write')
})


// Multer 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // 파일이 저장될 경로를 지정
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // 파일 이름 설정
    }
});

const upload = multer({ storage: storage });


app.post('/write', upload.single('postimg'), async (req, res) => {
    const { title, content, createAtDate } = req.body;
    const postImg = req.file ? req.file.filename : null;

    try {
        let db = await getDB();
        const result = await db.collection('counter').findOne({ name: 'counter' });
        await db.collection('posts').insertOne({
            _id: result.totalPost + 1,
            title,
            content,
            createAtDate,
            postImgPath: postImg ? `/uploads/${postImg}` : null,
        });
        await db.collection('counter').updateOne({ name: 'counter' }, { $inc: { totalPost: 1 } });
        res.redirect('/');
    } catch (error) {
        console.log(error);
    }
});

// 디테일 페이지
app.get('/detail/:id', async (req, res)=>{
    console.log(req.params.id);
    let id = parseInt(req.params.id)
    try{
        const db = await getDB()
        const posts = await db.collection('posts').findOne({_id: id})
        console.log(posts);
        res.render('detail', {posts})
    }catch(e){
        console.error(e);
    }
})

//삭제기능
app.post('/delete/:id', async (req, res)=>{
    let id = parseInt(req.params.id)
    try{
        const db = await getDB()
        await db.collection('posts').deleteOne({_id: id})
        res.redirect('/');
    }catch(e){
        console.error(e);
    }
})

// 수정페이지로 데이터 바인딩
app.get('/edit/:id', async (req, res)=>{
    let id = parseInt(req.params.id)
    try{
        const db = await getDB()
        const posts = await db.collection('posts').findOne({_id:id})
        res.render('edit', {posts})
    }catch(e){
        console.error(e);
    }
})

app.post('/edit', upload.single('postimg'), async (req, res)=>{
    console.log('-----', req.body);
    const {id, title, content, createAtDate } = req.body
    const postimgOld = req.body.postimgOld.replace('uploads/','')
    const postImg = req.file ? req.file.filename : postimgOld;

    try {
        const db = await getDB()
        await db.collection('posts').updateOne({_id : parseInt(id)},{
            $set : {
                title,
                content,
                createAtDate,
                postImgPath: postImg ? `/uploads/${postImg}` : null
            }
        })
        res.redirect('/')
    } catch (e) {
        console.error(e);
    }
})

app.get('/signup', (req, res)=>{
    res.render('signup')
})

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.post('/signup', async(req, res)=>{
    const {userid, pw, username} = req.body
    console.log('가입 정보 확인', req.body);

    try {
        const hashedPw = await bcrypt.hash(pw, saltRounds) //비밀번호 암호화
        const db = await getDB()
        await db.collection('users').insertOne({userid, username, pw : hashedPw})
        res.redirect('/login')
    } catch (e) {
        console.error(e);
    }

})

//로그인 페이지
app.get('/login', (req, res)=>{
    res.render('login')
})

app.post('/login',async(req,res)=>{
    const {userid, pw }= req.body

    try {
        const db = await getDB()
        const user = await db.collection('users').findOne({userid})
        console.log('로그인 데이터 ----',req.body, user);

        if(user){
            const compareResult = await bcrypt.compare(pw, user.pw)
            if(compareResult){
                res.redirect('/')
            }else{
                //비밀번호가 맞지 않을 경우
                res.status(401).send()
            }
        }else{
            // 아이디가 없을 때
            res.status(404).send()
        }
        
    } catch (e) {
        console.error(e);
    }
})

app.listen(port, ()=>{
    console.log(`잘돌아감 --- ${port}`);
})