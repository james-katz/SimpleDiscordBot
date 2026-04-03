const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    sequelize.define('question', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            primaryKey: true
        },
        question: {
            allowNull: false,
            type: DataTypes.TEXT                        
        },
        answers: {
            allowNull: false,
            type: DataTypes.JSON
        },
        language: {
            allowNull: false,
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'questions'
    });
}
