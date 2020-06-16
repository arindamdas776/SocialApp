const express = require('express');
const app = express();
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const server = http.createServer(app);
const Io = require('socket.io')(server);
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mongodb = require('mongodb');

var bcrypt = require('bcryptjs');

var database = require('../database/connection');

app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));

app.use(morgan('dev'));

app.use(express.static('public'));

app.set('views', './views');
app.set('view engine', 'ejs');

const upload = multer.diskStorage({
	destination: 'public/images/post/postImage',
	filename: (req, file, cb) => {
		cb(null, file.fieldname + '_' + Date.now() + '_' + path.extname(file.originalname));
	}
});

const postImage = multer({
	storage: upload
}).single('image_post');

app.get('/register', function (req, res, next) {
	res.render('register', { title: 'User Register section' });
});

app.post('/register', function (req, res) {
	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"email": req.body.email
		}, function (error, users) {
			if (error) throw error;

			if (users == null) {
				bcrypt.hash(req.body.password, 12, function (error, hash) {
					database.db.collection('users').insertOne({
						"username": req.body.username,
						"email": req.body.email,
						"password": hash
					}, function (error, result) {
						if (error) throw error;

						res.json({
							messages: "User Register successfull",
							success: true
						});
					});
				});
			} else {
				res.json({
					messages: "User email allreadt Exists",
					success: false
				});
			}
		})
	})
});

app.get('/login', function (req, res, next) {
	res.render('login', { title: 'User Login section' });
});

app.post('/login', function (req, res, next) {
	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"email": req.body.email
		}, function (error, result) {
			if (error) throw error;

			if (result == null) {
				res.json({
					messages: "User Email invalid",
					success: false
				});
			} else {
				var isValid = bcrypt.compare(req.body.password, result.password);

				if (isValid == null) {
					res.json({
						messages: "User password invalid",
						success: false
					});
				} else {
					const token = jwt.sign({ 'email': result.email }, 'LoginToken', {
						expiresIn: 60 * 60 * 24 * 7
					});

					database.db.collection('users').updateOne({
						"email": result.email
					}, {
						$set: {
							"accessToken": token
						}
					}, function (error, data) {
						if (error) throw error;

						res.json({
							messages: "Login successfull",
							token: token,
							success: true
						});
					})

				}
			}
		})
	})
});


app.get('/home', function (req, res, next) {
	res.render('home', { title: 'Home page section' });
});

app.post('/new-post', postImage, function (req, res, next) {

	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"accessToken": req.body.token
		}, function (error, result) {
			if (error) throw error;

			if (result == null) {
				res.json({
					messages: "User Need to authorize first ",
					success: false
				});
			} else {
				database.db.collection('posts').insertOne({
					"caption": req.body.post_caption,
					"postImage": req.file.filename,
					"like": [],
					"comment": [],
					"share": [],
					"users": {
						"_id": result._id,
						"username": result.username,
						"email": result.email,
						"ProfileImage": result.ProfileImage,
					}
				}, function (error, data) {
					if (error) throw error;

					database.db.collection('users').updateOne({
						"_id": result._id
					}, {
						$push: {
							"posts": {
								"_id": data.insertedId,
								"caption": req.body.post_caption,
								"postImage": req.file.filename,
								"like": [],
								"share": [],
								"users": {
									"_id": result._id,
									"username": result.username,
									"email": result.email
								}
							}
						}
					}, function (error, result) {
						if (error) throw error;

						res.json({
							messages: "Post Created successfully",
							success: true
						});
					});
				});
			}
		});
	});
});

app.post('/get-posts', function (req, res, next) {
	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"accessToken": req.body.token
		}, function (error, result) {
			console.log(result);
			if (error) throw error;

			if (result == null) {
				res.json({
					messages: "User Need to Authorize",
					success: false
				});
			} else {
				var ids = [];
				ids.push(result._id);

				database.db.collection('posts').find({
					"users._id": {
						$in: ids
					}
				}).toArray(function (error, posts) {
					if (error) throw error;
					// console.log(posts);
					if (result) {
						res.json({
							messages: "User Posts Are fatching",
							success: true,
							posts: posts
						});
					} else {
						res.json({
							messages: "posts not found",
							success: false
						});
					}
				})
			}
		});
	});
});

app.post('/do-like', function (req, res, next) {
	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"accessToken": req.body.token
		}, function (error, users) {
			if (error) throw error;

			if (users == null) {
				res.json({
					messages: "User Need to login first",
					success: true
				});
			} else {
				database.db.collection('posts').findOne({

					"_id": mongodb.ObjectID(req.body.id)
				}, function (error, posts) {

					if (error) throw error;

					if (posts == null) {
						res.json({
							messages: "No post found",
							success: false
						});
					} else {
						let isLike = false;
						for (let i = 0; i < posts.like.length; i++) {
							const like = posts.like[i];
							console.log(like._id.toString());

							if (like._id.toString() == users._id.toString()) {
								isLike = true;
								console.log(isLike);
								break;
							}
						}
						console.log(isLike);
						if (isLike) {
							//  console.log("post all ready has like");
							database.db.collection('posts').updateOne({
								"_id": mongodb.ObjectID(req.body.id)
							}, {
								$pull: {
									"like": {
										"_id": users._id
									}
								}
							}, function (error, data) {
								if (error) throw error;

								database.db.collection('users').updateOne({
									$and: [{
										"_id": posts.users._id
									}, {
										"post._id": posts._id
									}]
								}, {
									$pull: {
										"posts.$[].like": {
											"_id": users._id
										}
									}
								})
							});

							res.json({
								messages: "Users Post has been disLike",
								success: true
							})
						} else {
							database.db.collection('users').updateOne({
								"_id": posts.users._id
							}, {
								$push: {
									"notifications": {
										"_id": mongodb.ObjectID(),
										"username": users.username,
										"email": users.email
									}
								}
							}, function (error, result) {
								if (error) throw error;

								database.db.collection('users').updateOne({
									$and: [{
										"_id": posts.users._id
									}, {
										"posts._id": posts._id
									}]
								}, {
									$push: {
										"posts.$[].like": {
											"_id": users._id,
											"username": users.username,
											"email": users.email
										}
									}
								}, function (error, result) {
									if (error) throw error;

									database.db.collection('posts').updateOne({
										"_id": mongodb.ObjectID(req.body.id)
									}, {
										$push: {
											"like": {
												"_id": users._id,
												"username": users.username,
												"email": users.email
											}
										}
									});

									res.json({
										messages: "User post Like successfully",
										success: true
									});
								});
							});
						}
					}
				});
			}
		});
	});
});

app.post('/do-comment', function (req, res, next) {
	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"accessToken": req.body.token
		}, function (error, users) {
			if (error) throw error;

			if (users == null) {
				res.json({
					messages: "User Need to Authorize",
					success: false
				});
			} else {
				database.db.collection('posts').findOne({
					"_id": mongodb.ObjectID(req.body._id)
				}, function (error, posts) {
					if (error) throw error;

					if (posts == null) {
						res.json({
							messages: "Post not found",
							success: false
						});
					} else {
						database.db.collection('posts').updateOne({
							"_id": mongodb.ObjectID(req.body._id)
						}, {
							$push: {
								"comment": {
									"_id": mongodb.ObjectID(),
									"users": {
										"_id": users._id,
										"email": users.email,
										"username": users.username
									},
									"comment": req.body.user_comment,
									"created_at": new Date().getTime(),
									replies: []
								}
							}
						}, function (error, result) {
							if (error) throw error;

							if (users._id.toString() !== posts.users._id) {
								database.db.collection('users').updateOne({
									"_id": posts.users._id
								}, {
									$push: {
										notifications: {
											"_id": mongodb.ObjectID(),
											"username": users.username,
											"type": "new_comment",
											"content": `${users.username} has comment new post`,
											"created_at": new Date().getTime()
										}
									}
								});

								database.db.collection('users').updateOne({
									$and: [{
										"_id": posts.users._id
									}, {
										"posts._id": posts._id
									}]
								}, {
									$push: {
										"posts.$[].comment": {
											"_id": mongodb.ObjectID(),
											"users": {
												"_id": users._id,
												"username": users.username,
												"email": users.email
											},
											"comment": req.body.user_comment,
											"created_at": new Date().getTime(),
											"replies": []
										}
									}
								});

								res.json({
									messages: "User comment created successfully",
									success: true
								});
							}
						});
					}
				});
			}
		});
	});
});

app.post('/share-posts', function (req, res, next) {
	var accessToken = req.body.token;
	var _id = req.body._id;
	var type = "sharedPost";
	var created_at = new Date().getTime();

	database.db.collection('users').findOne({
		"accessToken": accessToken
	}, function (error, users) {
		if (error) throw error;

		if (users == null) {
			res.json({
				messages: "User need to Login first",
				success: false
			});
		} else {
			database.db.collection('posts').findOne({
				"_id": mongodb.ObjectID(_id)
			}, function (error, posts) {
				if (error) throw error;

				if (posts == null) {
					res.json({
						messages: "User post not found",
						success: false
					});
				} else {
					database.db.collection('posts').updateOne({
						"_id": mongodb.ObjectID(_id)
					}, {
						$push: {
							"share": {
								"_id": users._id,
								"username": users.username,
								"email": users.email
							}
						}
					}, function (error, data) {
						if (error) throw error;

						database.db.collection('posts').insertOne({
							"caption": posts.caption,
							"postImage": posts.postImage,
							"like": [],
							"share": [],
							comment: [],
							"users": {
								"_id": users._id,
								"username": users._username,
								"email": users.email
							}
						}, function (error, data) {
							if (error) throw error;

							database.db.collection('users').updateOne({
								$and: [{
									"_id": posts.users._id
								}, {
									"posts._id": posts._id
								}]
							}, {
								$push: {
									"posts": {
										"caption": posts.caption,
										"postImage": posts.postImage,
										"like": [],
										"share": [],
										comment: [],
										"users": {
											"_id": users._id,
											"username": users._username,
											"email": users.email
										}
									}
								}
							});

							res.json({
								messages: "User post hasbeen shared",
								success: true
							});
						});
					});
				}
			});
		}
	});
});

app.post('/user-details', function (req, res, next) {
	var token = req.body.token;

	database.connect(function (error) {
		if (error) throw error;

		database.db.collection('users').findOne({
			"accessToken": token
		}, function (error, users) {
			if (error) throw error;

			if (users == null) {
				res.json({
					messages: "User Need to Authorize first",
					success: false
				});
			} else {
				res.json({
					messages: "Users Details Fetching",
					success: true,
					users: users
				});
			}
		});
	});
});

app.get('/search-friends/:query', function (req, res, next) {
	var input_query = req.params.query;
	res.render('search', { title: 'Search Friends', query: input_query });
});

app.post('/search-friends', function (req, res, next) {
	// console.log(req.body);
	var query = req.body.query;
	database.connect(function (error) {
		database.db.collection('users').findOne({
			"accessToken": req.body.token
		}, function (error, result) {
			if (error) throw error;
			if (result == null) {
				res.json({
					messages: 'User Need to Login first',
					success: false
				})
			} else {
				database.db.collection('users').find({
					"username": {
						$regex: ".*" + query + ".*",
						$options: "i"
					}
				}).toArray(function (error, result) {
					if (error) throw error;

					// console.log(result);
					if (result) {
						res.json({
							messages: "User search Data fetching",
							success: true,
							query: result
						});
					} else {
						res.json({
							messages: "User Not Found",
							success: false
						});
					}
				});
			}
		})
	});
});

app.post('/friend-request', function (req, res, next) {
	database.connect(function (error) {
		if (error) throw error;
		//  auth users 
		database.db.collection('users').findOne({
			"accessToken": req.body.token
		}, function (error, user) {
			if (error) throw error;
			if (user == null) {
				res.json({
					messages: "User Need to Authorize First",
					success: false
				})
			} else {
				//  friend id 
				database.db.collection('users').findOne({
					"_id": mongodb.ObjectID(req.body._id)
				}, function (error, result) {
					if (error) throw error;
					if (result == null) {
						res.json({
							messages: "No user has been found",
							success: false
						})
					} else {
						// update auth users list 
						database.db.collection('users').updateOne({
							"_id": user._id
						}, {
							$push: {
								"friends": {
									"_id": result._id,
									"username": result.username,
									"email": result.email
								}
							}
						}, function (error, data) {
							if (error) throw error;
							//  friends users list upate 

							database.db.collection('users').updateOne({
								"_id": mongodb.ObjectID(req.body._id)
							}, {
								$push: {
									"friends": {
										"_id": user._id,
										"username": user._id,
										"email": user.email
									}
								}
							});
							res.json({
								messages: "Friend Request has been send successfully",
								success: true
							});
						});
					}
				});
			}
		});
	});
});

app.get('/friends', function (req, res, next) {
	res.render('friends', { title: 'Friends Page' });
});

server.listen(4000, () => {
	console.log(`server running on PORT ${4000}`);
});