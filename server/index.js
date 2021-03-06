var aws = require('aws-sdk')
const PORT = process.env.PORT || 3003;

//PIPELINE PREVENT MEMORY LEAK
// const videoPath = "videos/Sample.mp4";
const videoPath = "videos/SampleWKeyFrame.mp4";
const videoPathS3 = "SampleWKeyFrame.mp4";
// const videoPath = "videos/720Video.mp4";

const multer  = require('multer');
var storage = multer.diskStorage({   
    destination: function(req, file, cb) { 
       cb(null, './uploads');    
    }, 
    filename: function (req, file, cb) { 
       cb(null , file.originalname);   
    }
 });
const upload = multer({ storage: storage }).single("demo_video");

// var megaByteMultipler = 25;
// var megaByteMultipler = 10;
var megaByteMultipler = 5;
// var megaByteMultipler = 2.5;
// var megaByteMultipler = 0.1;
const { createReadStream } = require('fs');
const { pipeline } = require('stream');
const { createServer } = require('http');
const server = createServer(
    (req, res) => {
        pipeline(createReadStream(videoPath), pipe(res), (err) =>{
            if(err) console.error(err);
        })
    }
)

var i = 0;
var express = require('express'),
    app = express(),
    fs = require("fs");

var bodyParser = require('body-parser');

var cors = require('cors');
var corsOptions = {
    origin: ["http://localhost:3000", "https://hls-js-dev.netlify.app"],
    optionsSuccessStatus: 200 // For legacy browser support
}

app.use(cors(corsOptions));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({
   extended: false
}));

app.use(bodyParser.json());

app.use('/video', express.static('videos'))
app.use('/video2', express.static('videos'))
app.use('/video3', express.static('videos'))
app.use('/videoDirectLink', express.static('videos'))


app.get("/api/getHello", (req, res) => {
    res.json({ message: "Hello from server!" });
});

app.post("/api/uploadVideo", (req, res) => {
    upload(req,res, (err) =>{
        if(err) {
            res.status(400).send("Something went wrong!");
        }
        res.send(req.file);
    })
});

app.post('/api/WriteJsonSchemaToFile', (req, res) => {
    var jsonSchema = req.body.jsonSchema;
    var path = `D:/Learn/FormIO/saved-schema/${req.body.fileName}.json`;
    const fs = require('fs');
    fs.writeFileSync(path, jsonSchema);
    res.json({message: "success"})
});

app.post('/',function(req,res){
    var username = req.body.username;
    var htmlData = 'Hello:' + username;
    res.send(htmlData);
    console.log(htmlData);
});

// VIDEO STREAMING
app.get("/", function (req, res) {
    // res.sendFile("/index.html", { root: "D:/Learn/FormIO/react-node-app" });
    console.log('hello world');
});

// CHUNK
app.get('/video', (req, res) => {
    i++;
    const range = req.headers.range;
    if (!range) {
        res.status(400).send("Requires Range header");
    }
    else {
        console.log(`Range = ${range}`);
    }

    // get video stats
    const videoSize = fs.statSync(videoPath).size;

    // Parse Range
    // Example: "bytes=32324-"
    const CHUNK_SIZE = megaByteMultipler * (10 ** 6); // 1MB
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

    // Create headers
    const contentLength = end - start + 1;
    console.log(`video hit (${i}). chunkSize=${CHUNK_SIZE/1000000} MB. start = ${start}. end = ${end}. contentLength = ${contentLength}, videoSize = ${videoSize}`);
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4",
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(206, headers);

    // create video read stream for this particular chunk
    const videoStream = fs.createReadStream(videoPath, { start, end });
    // console.log(videoStream);

    // Stream the video chunk to the client
    videoStream.pipe(res);
});

// CHUNK IF REQUEST HEADER CONTAIN RANGE
app.get('/video2', (req, res) => {
    i++;
    const videoStat = fs.statSync(videoPath);
    const fileSize = videoStat.size;
    const videoRange = req.headers.range;
    console.log(videoRange);
    if (videoRange) {
        console.log(`With range header ${videoRange}`);
        const CHUNK_SIZE = megaByteMultipler * (10 ** 6); // 1MB
        const start = Number(videoRange.replace(/\D/g, ""));
        const end = Math.min(start + CHUNK_SIZE, fileSize - 1);
        
        const contentLength = (end-start) + 1;
        console.log(`video2 hit (${i}). chunkSize=${CHUNK_SIZE}. start = ${start}. end = ${end}. contentLength = ${contentLength}, videoSize = ${fileSize}`);
        const file = fs.createReadStream(videoPath, {start, end});
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        console.log("No range header");
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        console.log(`video2 hit (${i}). fileSize=${fileSize}`);
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

app.get('/videoDirectLink', function(req, res){
    i++;
    console.log(`videoDirectLink hit ${i}`);
    res.download(videoPath);
});

app.get('/videoDirectLinkS3', function(req, res){
    i++;
    console.log(`videoDirectLinkS3 hit ${i}`);

    aws.config.update(
        {
          accessKeyId: "AKIA36CZ7MNDVFWLOZF4",
          secretAccessKey: "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",
          region: 'ap-southeast-1'
        }
    );
    console.log(`Config updated.`);
    var s3 = new aws.S3();
    var options = {
        Bucket    : 'actxa-awp-material-dev',
        Key    : videoPathS3,
    };
    console.log(`Parameters updated.`);

    res.attachment(videoPathS3);
    var fileStream = s3.getObject(options).createReadStream();
    fileStream.pipe(res);
});

app.get('/videoHLS/:file', function(request, response){
    console.log(request.params.file);
    var filePath = `videos/${request.params.file}`;

    fs.readFile(filePath, function(error, content) {
        response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
        if (error) {
            if(error.code == 'ENOENT'){
                fs.readFile('./404.html', function(error, content) {
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                response.end(); 
            }
        }
        else {
            response.end(content, 'utf-8');
        }
    });

});

app.get('/videoHLSDirectLink', function(req, res){
    var filePath = "videos/Sample.m3u8"
    console.log('request starting...');
    res.download(filePath);
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});