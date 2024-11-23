const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const session = [];

const sequelize = require('./sequelize/index');
sequelize.authenticate()
.then(async ()=>{
    // await sequelize.sync({ force: false });

    console.log('Database up and running!');

})
.catch(err=> {
    console.log('Fatal: No connection to the database!');
    process.exit(1);
});

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.get('/get/:guild/:lang', async (req, res) => {
    const q = await sequelize.models.question.findAll({
        where: {
            guildId: req.params.guild,
            language: req.params.lang
        }        
    });
    res.json(q);
});

app.get('/getrand/:guild/:lang', async (req, res) => {    
    let guildId = req.params.guild;
    if(guildId == '1022920863303090206') guildId = '978714252934258779';
    
    let repeated = false;
    let q;

    const totalQ = await sequelize.models.question.count({
        where:{
            guildId: guildId,
            language: req.params.lang
        }
    });
    do {
        q = await sequelize.models.question.findAll({
            where: {
                guildId: guildId,
                language: req.params.lang
            },
            order: sequelize.random(),
            limit: 1
        });
        const qId = q[0].dataValues.id;
        const sess = session[guildId];        
        if(sess && sess.includes(qId)) {
            repeated = true;
            console.log('reetida')
        }
        else {
            addQuestionTimeOut(guildId, totalQ, qId);
            repeated = false;
        }
    } while(repeated);
    res.json(q);
});

app.get('/getseq/:guild/', async (req, res) => {    
    let guildId = req.params.guild;
    if(guildId == '1022920863303090206') guildId = '978714252934258779';
    
    let q = {};
    try {
        q = await sequelize.models.question.findAll({
            where: {
                guildId: guildId,
                language: 'pt'
            },
            order: [['id', 'ASC']], // Sort by `id` in ascending order
            // limit: 1
        });
        console.log('jasgfasfhsa',q);
        if (q.length == 0) q = {error: true};
    }
    catch {
        console.log("no more questions");
        q = {error: true}
    }   
       
    res.json(q);
});

app.delete('/delete/:id', async (req, res) => {
    sequelize.models.question.destroy({
        where: {
            id: req.params.id
        }
    })
    .then(() => {
        res.sendStatus(200);
        console.log('Question deleted!')     
    })
    
});

app.get('/guildlang/:guildId', async (req, res) => {
    let guildId = req.params.guildId;
    const lang = await sequelize.models.guild.findOne({
        where: {
            id: guildId
        }
    });
    if(guildId === '1022920863303090206') res.send('pt');
    else res.send(lang.language);
});

app.post('/insert/:guildId/:lang', async (req, res) => {
    let guildId = req.params.guildId;
    let lang = req.params.lang;
    let q = req.body;
    sequelize.models.question.create({
        question: q.question,
        answers: q.answers,
        language: lang,
        guildId: guildId
    }).then(()=> { res.sendStatus(200) });
});

app.put('/update/:quesId', async (req, res) => {    
    const q = await sequelize.models.question.findOne({ where: {id: req.params.quesId} });
    await q.update({
        question: req.body.question,
        answers: req.body.answers
    });
    q.save().then(()=>{ 
        console.log('Question was updated!') 
        res.sendStatus(200);
    });
});

app.get('/guildname/:guildId', async (req, res) => {
    console.log(req.params.guildId);

    // try {
        
        const guild = await sequelize.models.guild.findOne({ where: {id: req.params.guildId} });    
        res.json(guild);
    // }
    // catch {
    //     res.json({});
    // }
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Listening ...');
});

function addQuestionTimeOut(id, max,q) {
    max = max - 1;
    let timeOut = [];
    if(session[id]) timeOut = session[id];
    timeOut.push(q);
    if(timeOut.length > max) {
        timeOut.splice(0, timeOut.length - max); // remove oldest elements from beginning of array

    }
    session[id] = timeOut;
    console.log(session[id]);
}