const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    sequelize.define('question', {
        question: {
            allowNull: false,
            type: DataTypes.TEXT                        
        },
        answers: {
            allowNull: false,
            type: DataTypes.JSON
        },
        language: {
            aloowNull: false,
            type: DataTypes.TEXT
        }
    });
}