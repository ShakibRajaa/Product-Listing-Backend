const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const User = require("./model/user");
const Comment = require("./model/comment");
const Product = require("./model/product");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dotenv = require('dotenv')
dotenv.config()

const app = express();

const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
  
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (error) {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('./public'))

app.get("/", (req, res) => {
    res.send({ message: "All good!" });
});

app.post("/register", async (req, res) =>{
    try {
      const { name, email, mobile, password } = req.body;
  
      // Check if the required fields are provided
      if (!name || !email || !mobile || !password) {
        return res
          .status(400)
          .json({ error: "Please provide all required fields" });
      }
  
      // Check if a user with the same email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: "User already exists" });
      }
  
      // Hash the password using bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
  
      // Create a new user
      const newUser = new User({
        name,
        email,
        mobile,
        password: hashedPassword,
      });
  
      await newUser.save();
  
      // Generate and return the JWT token after sign up
      const user = await User.findOne({ email });
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: 600,
      });
      res.status(201).json({
        message: "User registered successfully",
        name: user.name,
        token,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

app.post("/login",async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if the required fields are provided
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Please provide email and password" });
      }
  
      // Find the user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
  
      // Compare the provided password with the stored hashed password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
  
      // Generate and return the JWT token
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: 600,
      });
      res
        .status(200)
        .json({ message: "Login successful", name: user.name, token });
    } catch (error) {
      res.status(500).json({ error: "Failed to login" });
    }
  });
/* PRODUCT ROUTES */
app.get("/getAllProducts",async (req, res) => {
    try {
      const filter = {};
      if (req.query.category) {
        const category = req.query.category.split(",");
        filter.category = { $in: category };
      }
  
      const products = await Product.find(filter).sort({
        [req.query.sortBy || "likes"]: -1,
      });
      res.json(products);
    } catch (err) {
      res.status(400).json("Error: " + err);
    }
  });

app.post("/addProduct",authenticateUser,async (req, res) => {
    const companyName = req.body.companyName;
    const category = req.body.category;
    const imageURL = req.body.imageURL;
    const productLink = req.body.productLink;
    const description = req.body.description;
    const likes = req.body.likes;
    const commentCount = req.body.commentCount;
  
    const newProduct = new Product({
      companyName,
      category,
      imageURL,
      productLink,
      description,
      likes,
      commentCount,
    });
  
    try {
      await newProduct.save();
      res.json("Product added!");
    } catch (err) {
      res.status(400).json("Error: " + err);
    }
  });

app.put("/updateProductById",authenticateUser,async (req, res) => {
    try {
      if (!req.body.id) {
        return res.status(400).json({ message: "Product id is required" });
      }
  
      const product = await Product.findById(req.body.id);
      product.companyName = req.body.companyName;
      product.category = req.body.category;
      product.imageURL = req.body.imageURL;
      product.productLink = req.body.productLink;
      product.description = req.body.description;
  
      await product.save();
      res.status(200).json({ message: "Product updated successfully" });
    } catch (err) {
      console.log(err);
      res.status(400).json("Error: " + err);
    }
  });

  app.get("/getProductById/:id",async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      res.json(product);
    } catch (err) {
      res.status(400).json("Error: " + err);
    }
  });

app.put("/increaseLikeById/:id/like",async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      product.likes = product.likes + 1;
      await product.save();
      res.json(product);
    } catch (err) {
      res.status(400).json("Error: " + err);
    }
  })

/* COMMENTS ROUTES */

app.get("/getComments",async (req, res) => {
    try {
      const filter = {};
      if (req.query.productId) {
        filter.productId = req.query.productId;
      }
      const comment = await Comment.find(filter);
      res.json(comment);
    } catch (err) {
      res.status(400).json("Error: " + err);
    }
  });
app.post("/addComment",async (req, res) => {
    try {
      const newComment = new Comment({
        commentText: req.body.commentText,
        productId: req.body.productId,
      });
  
        const savedComment = await newComment.save();
        
        await Product.findByIdAndUpdate(req.body.productId, { $inc: { commentCount: 1 } })
  
      res.json(savedComment);
    } catch (err) {
      res.status(400).json("Error: " + err);
    }
  });

app.listen(process.env.PORT, () => {
    mongoose
      .connect(process.env.MONGODB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => console.log(`Server running on port: ${process.env.PORT}`))
      .catch((error) => console.log(error));
  });
  