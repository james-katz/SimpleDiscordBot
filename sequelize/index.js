const { Sequelize } = require('sequelize');

// Standard sequelize setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
	storage: 'dbs/zecquiz.sqlite',
	logQueryParameters: true,
	benchmark: true    
});

// Load all models
const loadModels = [
    require('./models/guild.model'),
    require('./models/question.model')
]

// Define the models
for(const loadModel of loadModels) {
    loadModel(sequelize);
}

// Manually setup associations
sequelize.models.guild.hasMany(sequelize.models.question);
sequelize.models.question.belongsTo(sequelize.models.guild);

module.exports = sequelize;