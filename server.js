const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const fs = require('fs');

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.get('/get', (req, res) => {
    fs.readFile('./questions.json', 'utf8', (err, data) => {
        if(err) throw err;
        res.json(JSON.parse(data));
    });
});

app.get('/getrand/:lang', (req, res) => {    
    let q = '';
    if(req.params.lang) {
        if(req.params.lang == 'pt') q = '/questions.json';
        else if(req.params.lang == 'en') q = '/questions-en.json';
        else q = '/questions.json';
        
    }
    fs.readFile((__dirname + q), 'utf8', (err, data) => {
        if(err) throw err;
        let q = JSON.parse(data);
        let randQ = q[Math.floor(Math.random() * (Object.keys(q).length - 1) )];
        res.json(randQ);
    });
});

app.get('/howmany', (req, res) => {
    fs.readFile('./questions.json', 'utf8', (err, data) => {
        if(err) throw err;
        let q = JSON.parse(data);
        
        res.json({'questions':Object.keys(q).length});
    });
});

app.post('/update', (req, res) => {
    res.sendStatus(200);
    fs.writeFile('questions.json', JSON.stringify(req.body), (err) => {
        if(err) {
            console.log('Error while writing to file. ' + err);
            return
        }
        console.log('File was written succesfully');
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Listening ...');
});