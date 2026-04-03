const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    sequelize.define('rank', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            unique: true,
            primaryKey: true
        },
        correctAnswers: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        wrongAnswers: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        userId: {
            type: DataTypes.TEXT,
            allowNull: false
        }
    }, {
        tableName: 'rank',
        indexes: [
            {
                unique: true,
                fields: ['userId']
            }
        ]
    });
}
