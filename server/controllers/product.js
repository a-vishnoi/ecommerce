const Product = require("../models/product");
const slugify = require("slugify");
const User = require("../models/user");

exports.create = async (req, res) => {
	try{
		console.log(req.body);
		const {title, description, price, category, subs, quantity, images, shipping, color, brand} = req.body;
		
		const product = await new Product({title, description, price, category, subs, quantity, images, slug: slugify(title), shipping, color, brand}).save();
	
		res.json(product);
	}
	catch(err){
		console.log(err);
		res.status(400).json({
			err : err.message
		});
	}
};

exports.listAll = async (req, res) => {
	
	let products = await Product.find({})
		.limit(parseInt(req.params.count))
		.populate('category')
		.populate('subs')
		.sort([['createdAt', 'desc']])
		.exec();
	
	res.json(products);
};

exports.remove = async (req, res) =>{
	
	try{
		const deleted = await Product.findOneAndRemove({
			slug: req.params.slug,
		}).exec();
		
		res.json(deleted);
	}
	catch(err){
		console.log(err);
		return res.status(400).send("Product Delet Failed");
	}
	
};

exports.read = async (req, res) =>{
	const product = await Product.findOne({slug: req.params.slug})
		.populate('category')
		.populate('subs')
		.exec();
	
	res.json(product);
};

exports.update = async (req, res) =>{
	try{
		if(req.body.title){
			req.body.slug = slugify(req.body.title);
		}
		
		const updated = await Product.findOneAndUpdate({slug: req.params.slug}, req.body, {new: true}).exec();
		res.json(updated);
	}
	catch(err){
		console.log(err);
		res.status(400).json({
			err : err.message
		});
	}
};

// without pagination
// exports.list = async (req, res) => {
// 	try{
// 		const {sort, order, limit} = req.body;
//
// 		const products = await Product.find({})
// 			.populate('category')
// 			.populate('subs')
// 			.sort([[sort, order]])
// 			.limit(limit)
// 			.exec();
// 		res.json(products);
// 	}
// 	catch(err){
// 		res.json(err);
// 	}
// };

exports.list = async (req, res) => {
	try{
		const {sort, order, page} = req.body;
		const currentPage = page || 1;
		const perPage = 3;
		
		const products = await Product.find({})
			.skip((currentPage-1)*perPage)
			.populate('category')
			.populate('subs')
			.sort([[sort, order]])
			.limit(perPage)
			.exec();
		
		res.json(products);
	}
	catch(err){
		res.json(err);
	}
};


exports.productsCount = async (req, res) => {
	let total = await Product.find({}).estimatedDocumentCount().exec();
	console.log(total);
	res.json(total);
};

exports.productStar = async (req, res) => {
	const product = await Product.findById(req.params.productId).exec();
	console.log("Star Controller");
	const user = await User.findOne({email: req.user.email}).exec();
	const {star} = req.body;
	//check if currently logged in user has already added rating to the product
	
	let existingRatingObject = product.ratings.find((element)=> (element.postedBy.toString() === user._id.toString()));
	
	if(existingRatingObject === undefined){
		let ratingAdded = await Product.findByIdAndUpdate(product._id, {
			$push: { ratings: { star: star, postedBy: user._id} }
		}, {new:true}).exec();
		console.log("ratingAdded", ratingAdded);
		res.json(ratingAdded);
	}
	else{
		const ratingUpdated	 = await Product.updateOne(
			{ratings: { $elemMatch: existingRatingObject},
			}, {$set: {"ratings.$.star" : star}}, {new:true}).exec();
		
		console.log("ratingUpdated", ratingUpdated);
		res.json(ratingUpdated);
	}
	
};

exports.listRelated = async (req, res) => {
	
	const product = await Product.findById(req.params.productId).exec();
	
	const related = await Product.find({
		_id: { $ne: product._id },
		category: product.category
	})
		.limit(3)
		.populate('category')
		.populate('subs')
		.populate('postedBy')
		.exec();
	
	res.json(related);
};

// Search / Filter

const handleQuery = async (req, res, query) => {
	
	const products = await Product.find({ $text: { $search: query } })
		.populate('category', '_id name')
		.populate('subs', '_id name')
		.populate('postedBy', '_id name')
		.exec();
	
	res.json(products);
	
}


const handlePrice = async (req, res, price) => {

	try{
		let products = await Product.find({
			price: {
				$gte: price[0],
				$lte: price[1]
			},})
			.populate('category', '_id name')
			.populate('subs', '_id name')
			.populate('postedBy', '_id name')
			.exec();
		
		res.json(products);
	}
	catch(err){
		console.log("handle price error ==>",err);
	}
};

const handleCategory = async (req, res, category) => {
	try{
		let products = await Product.find({category})
			.populate('category', '_id name')
			.populate('subs', '_id name')
			.populate('postedBy', '_id name')
			.exec();
		
		res.json(products);
	}
	catch(err){
		console.log("handle category error ==>",err);
	}
};

const handleStars = (req, res, stars) => {
	Product.aggregate([
		{
			$project:{
				document: "$$ROOT",
				floorAverage: {
					$floor: { $avg: '$ratings.star'}
				},
			}
		},
		{ $match: { floorAverage: stars } }
	]).limit(12)
		.exec((err, aggregate) => {
			if(err) console.log('Aggregate error --->', err);
			Product.find({_id:aggregate})
				.populate('category', '_id name')
				.populate('subs', '_id name')
				.populate('postedBy', '_id name')
				.exec((err, products) => {
					if(err) console.log('Aggregate products error --->', err);
					res.json(products);
				});
		});
};

const handleSub = async (req, res, sub) => {
	try{
		let products = await Product.find({subs: sub})
			.populate('category', '_id name')
			.populate('subs', '_id name')
			.populate('postedBy', '_id name')
			.exec();
		
		res.json(products);
	}
	catch(err){
		console.log("handle category error ==>",err);
	}
};

const handleShipping = async (req, res, shipping) => {
	const products = await Product.find({shipping})
		.populate('category', '_id name')
		.populate('subs', '_id name')
		.populate('postedBy', '_id name')
		.exec();
	
	res.json(products);
};

const handleColor = async (req, res, color) => {
	const products = await Product.find({color})
		.populate('category', '_id name')
		.populate('subs', '_id name')
		.populate('postedBy', '_id name')
		.exec();
	
	res.json(products);
};

const handleBrand = async (req, res, brand) => {
	
	const products = await Product.find({brand})
		.populate('category', '_id name')
		.populate('subs', '_id name')
		.populate('postedBy', '_id name')
		.exec();
	
	res.json(products);
	
};

exports.searchFilters = async (req, res) => {
	
	const {query, price, category, stars, sub, shipping, color, brand} = req.body;
	
	if(query){
		//console.log(query);
		await handleQuery(req, res, query);
	}
	
	if(price !== undefined){
		//console.log("price--->",price);
		await handlePrice(req,res, price);
	}
	
	if(category){
		//console.log("category--->", category);
		await handleCategory(req,res, category);
	}
	
	if(stars){
		//console.log("stars--->", stars);
		await handleStars(req,res, stars);
	}
	
	if(sub){
		//console.log("sub--->", sub);
		await handleSub(req,res, sub);
	}
	
	if(shipping){
		await handleShipping(req,res, shipping);
	}
	
	if(color){
		await handleColor(req,res, color);
	}
	
	if(brand){
		await handleBrand(req,res, brand);
	}
	
};
