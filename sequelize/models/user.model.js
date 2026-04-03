const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    sequelize.define('user', {
        id: {
            type: DataTypes.TEXT,
            autoIncrement: false,
            unique: true,
            primaryKey: true
        }
    }, {
        tableName: 'users'
    });
}
