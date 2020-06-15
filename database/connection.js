const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;

module.exports.connect = function connect(callback) {
	console.log('Database connection successfull');
	  MongoClient.connect('mongodb://localhost:27017', function(error,client){
		   module.exports.db = client.db('socialApp');

		   callback(error);
	  });
}