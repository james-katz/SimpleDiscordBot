const { DataTypes, TEXT } = require('sequelize');

module.exports = (sequelize) => {
    sequelize.define('guild', {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: false,
            unique: true,
            primaryKey: true
          },
          name: {
            type: TEXT,
            aloowNull: false
          },
          language: {
            type: TEXT,
            aloowNull: false,
            defaultValue: 'en'
          }
    });
}