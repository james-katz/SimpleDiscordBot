const { Sequelize } = require('sequelize');

// Standard sequelize setup
const sequelize = new Sequelize({
    dialect: 'sqlite',
	storage: 'dbs/zecquiz.sqlite',
	logQueryParameters: false,
	benchmark: false,
    sync: false 
});

// Load all models
const loadModels = [
    require('./models/question.model'),
    require('./models/user.model'),
    require('./models/rank.model')
]

// Define the models
for(const loadModel of loadModels) {
    loadModel(sequelize);
}

sequelize.models.user.hasMany(sequelize.models.rank, { foreignKey: 'userId', sourceKey: 'id' });
sequelize.models.rank.belongsTo(sequelize.models.user, { foreignKey: 'userId', targetKey: 'id' });

module.exports = sequelize;
