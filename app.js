//INITAILIZING NEEDED MODULES: EXPRESS, FILE PATH, BODYPARSER, EJS, AND DECLARING VARIABLES

//Setting up the express module
import express from "express";
//had to change the port since port 3000 was occupied by the pgAdmin
const port = 4000;
const app = express();

//Setting up file path module
import { fileURLToPath } from "url";
import path, { dirname } from "path"; 
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

//Middleware setup
import bodyParser from "body-parser";
app.use(bodyParser.urlencoded({ extended: true }));

//EJS view engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//Storage variable for blog posts
let posts = [];

//POSTGRESSQL setup
//importing and declaring variables
//importing pg
import pkg from 'pg'; // Import the entire package
const { Pool } = pkg; // Destructure the Pool class
const pool = new Pool({
    //replace with username
    user: 'your_user',
    //local host
    host: 'localhost',
    //database name
    database: 'BlogDB',
    //replace password
    password: 'your_password',
    //port
    port: 3000,
});

//SETTING UP PAGE ROUTES THROUGH GET METHODS

//routing to tehe default page, ie 
app.get('/', async (req, res) => {
    try {
        //Retrieving all blog posts from database
        const result = await pool.query('SELECT * FROM blogs ORDER BY date_created DESC');
        const posts = result.rows; // Get the posts from the query result
        res.render('index.ejs', { posts: posts }); // Render the index.ejs with the posts
    }
    //if theres any errors when it retrieves blog posts
    catch (error) {
        //display the error message
        console.error('Error retrieving posts:', error);
        res.status(500).send('Internal Server Error');
    }
});

//routing to a create post page, ie createPost
app.post('/createPost', async (req, res) => {
    const { name, title, content } = req.body;
    //a timestamp for data_created
    const time = new Date();
    //posts.push({ name, title, content, time });
    //res.redirect('/');
    try {
        //inserting new blog post into blog table
        await pool.query(
            'INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created) VALUES ($1, $2, $3, $4, $5)',
            [name, 'some_user_id', title, content, time] // Replace 'some_user_id' with actual user ID if available
        );
        //redirecting back to homepage
        res.redirect('/');
    }
    //if there is an error
    catch (error) {
        //error messages
        console.error('Error creating blog post:', error);
        res.status(500).send('Internal Server Error');
    }
});

//routing to a edit post page ie editPost
app.get('/editPost/:id', async (req, res) => {
    const postId = req.params.id;
    try {
        const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [postId]);
        const post = result.rows[0];

        //checks if the post exists and user is creator
        if (post && post.creator_id === req.session.user_id) {
            res.render('editPost.ejs', { post });
        }
        //if not then the user isn't authorized
        else {
            res.status(403).send('Unauthorized: You cannot edit this post.');
        }
    }
    //othwerwise there will be an error if no criteria is met 
    catch (error) {
        console.error('Error loading post for edit:', error);
        res.status(500).send('Internal Server Error');
    }
});

//updating Post through a updatePost page
app.post('/updatePost/:id', async (req, res) => {
    const postId = req.params.id;
    const { title, content } = req.body;
    try {
        // Ensures user is authorized to edit the post
        const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [postId]);
        const post = result.rows[0];

        if (post && post.creator_id === req.session.user_id) {
            // Updates  post in  database
            await pool.query('UPDATE blogs SET title = $1, content = $2 WHERE id = $3', [title, content, postId]);
            // Redirect to the homepage to see the updated post
            res.redirect('/'); 
        } 
        //otherwise its unauthorized
        else {
            res.status(403).send('Unauthorized: You cannot edit this post.');
        }
    } 
    //if no criteria is met then it means there must be an error
    catch (error) {
        console.error('Error updating post:', error);
        res.status(500).send('Internal Server Error');
    }
});

//Deleting the selected post page
app.get('/deletePost/:id', async (req, res) => {
    const postId = req.params.id; // Get the post ID from the route parameter

    try {
        const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [postId]);
        const post = result.rows[0];

        // Check if post exists and the user is the creator
        if (post && post.creator_id === req.session.user_id) {
            res.render('deletePost.ejs', { post });
        }else {
            res.status(403).send('Unauthorized: You cannot delete this post.');
        }
    }
    //if no criteria is met then it ust be an error
    catch (error) {
        console.error('Error loading post for deletion:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Deleting the post
app.post('/deletePost/:id', (req, res) => {
    const postId = parseInt(req.params.id, 10);
    posts.splice(postId, 1); 
    res.redirect('/');
});

//sign up page
app.get('/signup', (req, res) => {
    res.render('signup');
});
//handling signup form submission
app.post('/signup', async (req, res) => {
    const { user_id, password, name } = req.body;

    try {
        // Check if user_id already exists
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
        
        if (result.rows.length > 0) {
            // User ID already exists
            res.send('User ID already taken. Please choose a different one.');
        } else {
            // Insert new user into the users table
            await pool.query('INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)', [user_id, password, name]);
            res.redirect('/signin'); // Redirect to the sign-in page
        }
    } catch (error) {
        console.error('Error signing up:', error);
        res.status(500).send('Internal Server Error');
    }
});


//routing to sign-in page
app.get('/signin', (req, res) => {
    res.render('signin');
});
//handling sign-in page
app.post('/signin', async (req, res) => {
    const { user_id, password } = req.body;

    try {
        // Check for user_id and password
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1 AND password = $2', [user_id, password]);
        
        if (result.rows.length === 0) {
            // if no match were found
            res.send('Incorrect user ID or password. Please try again.');
        }
        else {
            // User authenticated, setting user id in session and sent to default blog page
            req.session.user_id = result.rows[0].user_id;
            //sends back to default blog page
            res.redirect('/');
        }
        //if theres any error that has occured...
    } catch (error) {
        console.error('Error signing in:', error);
        res.status(500).send('Internal Server Error');
    }
});


//SERVER

//initializing server and starting it up for "listening"
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
