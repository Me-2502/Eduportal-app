import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import { default as mongodb } from 'mongodb';
import cors from 'cors';

const MongoClient = mongodb.MongoClient;
const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();
const database = client.db('School');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/School', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// MongoDB Schemas
const StudentSchema = new mongoose.Schema({
  Year: Number,
  Division: String,
  Roll_no: Number,
  Password: String
});
const Student = mongoose.model('Student', StudentSchema);

const FacultySchema = new mongoose.Schema({
  FirstName: String,
  LastName: String,
  Password: String
});
const Faculty = mongoose.model('Faculty', FacultySchema);

const GradesSchema = new mongoose.Schema({
  StudentId: String,
  Standard: Number,
  Maths: Number,
  Science: Number,
  English: Number,
  SS: Number,
  Hindi: Number,
  Gujarati: Number,
  PE: Number,
  Extra: Number
});
const Grades = mongoose.model('Grades', GradesSchema);

// Student login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const collection = database.collection('Students');
    const student = await collection.findOne({ Password: password, Roll_no: Number(username.substring(5, 7)), Division: username[4], Year: Number(username.substring(0, 4)) });
    if (student != null) {
        return res.status(200).json(student);
    }
    res.status(401).json({ message: 'Invalid credentials' });
} catch (err) {
    res.status(500).json({ error: err.message });
}
});

// Change Student Password API
app.post('/api/auth/changestudentpassword', async (req, res) => {
    try {
        const { username, password } = req.body;
        const collection = database.collection('Students');
        const updated = await collection.findOneAndUpdate(
            { Roll_no: Number(username.substring(5, 7)), Division: username[4], Year: Number(username.substring(0, 4)) },
            { Password: password },
            { new: true }
        );
        if (updated) return res.json(true);
        res.status(401).json({ message: 'Invalid credentials' });
  } catch (err) {
        res.status(500).json({ error: err.message });
  }
});

// Get Student Marks
app.post('/api/auth/getmarks', async (req, res) => {
  try {
    const { username } = req.body;
    const collection = database.collection('Grades')
    const grades = await collection.find({ StudentId: username });
    res.json(grades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on("error", (err) => {
  console.error("Error starting server:", err);
});