import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from 'bcryptjs';
//import fetch from 'node-fetch';
import session from 'express-session';
import multer from 'multer';
import path from 'path';

const ADMIN = 'hospital';
const PASSWORD = 'mini3';

const PORT = 3000;
const app = express({
    json: { limit: '10mb' },
    urlencoded: { limit: '10mb', extended: true }
  });
  

const db = new pg.Client({
    user: "mini_3",
    host: "dpg-cs0ha7ggph6c73a8edl0-a",
    database: "hospital_yo3l",
    password: "wKlFIzMdX7za6bjwUr0EPKh1OIXWwnw7",
    port: 5432,
});
db.connect();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use(session({
    secret: 'hospital',
    resave: false,
    saveUninitialized: true,
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.admin = req.session.admin;
    res.locals.patient = req.session.patient;
    next();
});

app.get('/', (req,res) => {
    res.render("index.ejs");
});



// app.post('/chat', async (req, res) => {
//     const { message } = req.body;
//     try {
//         // Simple logic for the chatbot response
//         const response = await fetch('https://api.example.com/chatbot', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ message }),
//         });

//         const data = await response.json();
//         res.json({ reply: data.reply });
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: 'Failed to get response from chatbot' });
//     }
// });

app.get('/doctors', async (req, res) => {
    try {
        //console.log(req);
        const Speciality = req.query.Speciality;
        const result = await db.query("SELECT * FROM doctors WHERE Speciality = $1", [Speciality]);
        res.render('doctors.ejs', { doctors: result.rows , speciality: Speciality});
      } catch (err) {
        console.error(err);
        res.send('Error occurred while fetching data.');
      }
})

app.get('/doctors_appointment', async (req, res) => {
    try {
        const Speciality = req.query.Speciality;
        const result = await db.query("SELECT * FROM doctors WHERE Speciality = $1", [Speciality]);
        res.json(result.rows);
        // console.log(result.rows);
      } catch (err) {
        console.error(err);
        res.send('Error occurred while fetching data.');
      }
});

app.get('/doctor_timeslots', async (req, res) => {
    try {
        //console.log(req.query);
        const doctorId = req.query.doctorId;
        const result = await db.query("SELECT time_slots FROM doctors WHERE doctorid = $1", [doctorId]);
        res.json(result.rows[0].time_slots);
        // console.log(result.rows);
    } catch (err) {
        console.error(err);
        res.send('Error occurred while fetching time slots.');
    }
});


function isUserAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/appointments', isUserAuthenticated, (req, res) => {
    res.render('appointments.ejs');
});


app.post('/appointments', async (req, res) => {
    const { firstname, lastname, email, phone, Speciality, doctor, timeSlot, appointment_date } = req.body;
    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 1);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 6);

    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const phoneRegex = /^(\+91\s?)?([6789]\d{9})$/;
    const alpha = /^[A-Za-z\s'-]+$/;

    if(!alpha.test(firstname)) {
        return res.json({ success: false, message: 'First name should contain only alphabets' });
    }

    if(!alpha.test(lastname)) {
        return res.json({ success: false, message: 'Last name should contain only alphabets' });
    }

    if (!emailRegex.test(email)) {
        return res.json({ success: false, message: 'Invalid email format.' });
    }

    if (!phoneRegex.test(phone)) {
        return res.json({ success: false, message: 'Invalid phone number. Please enter a valid Indian phone number.' });
    }

    const appointmentDate = new Date(appointment_date);

    if (appointmentDate < minDate || appointmentDate > maxDate) {
        return res.status(400).json({ success: false, message: 'Appointment date must be between tomorrow and 6 days later.' });
    }
    try {
        await db.query(
            'INSERT INTO appointments (firstname, lastname, email, phone, speciality, doctor_id, time_slot, appointment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [firstname, lastname, email, phone, Speciality, doctor, timeSlot, appointment_date]
        );
        res.json({ success: true, message: 'Appointment booked successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error, could not book appointment. Try again later' });
    }
});


app.get('/login', (req, res) => {
    res.render('login.ejs');
});


app.post('/login', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND email = $2', [username, email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.user = user;
                res.json({ success: true, message: 'Login successful!' });
            } else {
                res.json({ success: false, message: 'Incorrect password!' });
            }
        } else {
            res.json({ success: false, message: 'User not found! ' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

app.post('/signup', async (req, res) => {
    const { username, email, password, first_name, last_name, date_of_birth, phone_number, address } = req.body;

    const usernameRegex = /^[a-z0-9_]+$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    const phoneRegex = /^(\+91\s?)?([6789]\d{9})$/;
    // const alpha = /^[A-Za-z\s'-]+$/;

    if (!usernameRegex.test(username)) {
        return res.json({ success: false, message: 'Username can only contain lowercase letters, numbers, and underscores.' });
    }

    if (!emailRegex.test(email)) {
        return res.json({ success: false, message: 'Invalid email format.' });
    }

    if (!passwordRegex.test(password)) {
        return res.json({ success: false, message: 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character.' });
    }

    if (!phoneRegex.test(phone_number)) {
        return res.json({ success: false, message: 'Invalid phone number. Please enter a valid Indian phone number.' });
    }

    const alpha = /^[A-Za-z\s'-]+$/;

    if(!alpha.test(first_name)) {
        return res.json({ success: false, message: 'First name should contain only alphabets' });
    }

    if(!alpha.test(last_name)) {
        return res.json({ success: false, message: 'Last name should contain only alphabets' });
    }

    try {
        const userCheck = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.json({ success: false, message: 'Username already exists!' });
        }
        
        const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.json({ success: false, message: 'Email already exists!' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, email, password, first_name, last_name, date_of_birth, phone_number, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [username, email, hashedPassword, first_name, last_name, date_of_birth, phone_number, address]
        );
        res.json({ success: true, message: 'Signup successful!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});


app.get('/admin-login', (req, res) => {
    res.render('admin-login.ejs');
});

app.post('/admin-login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN && password === PASSWORD) {
        req.session.admin = { username };
        res.redirect('/admin');
    } else {
        res.send('<script>alert("Invalid credentials!"); window.location.href = "/admin-login";</script>');
    }
});

app.get('/admin-logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            res.redirect('/admin');
        } else {
            res.redirect('/');
        }
    });
});

app.get('/admin', (req, res) => {
    if (req.session.admin) {
        res.render('admin.ejs');
    } else {
        res.redirect('/admin-login');
    }
});

app.get('/admin/add-doctor', (req, res) => {
    res.render('add-doctor.ejs');
});

app.post('/add-doctor', async (req, res) => {
    const { first_name, last_name, speciality, qualification, phone, email, address, age, gender, imageurl, time_slots } = req.body;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const phoneRegex = /^(\+91\s?)?([6789]\d{9})$/;

    if (!emailRegex.test(email)) {
        return res.json({ success: false, message: 'Invalid email format.' });
    }

    if (!phoneRegex.test(phone)) {
        return res.json({ success: false, message: 'Invalid phone number. Please enter a valid Indian phone number.' });
    }

    const timeSlotsArray = Array.isArray(time_slots)
        ? time_slots
        : time_slots.split('\n').map(slot => slot.trim()).filter(slot => slot);

    try {
        await db.query(
            'INSERT INTO doctors (firstname, lastname, speciality, qualification, phonenumber, email, address, age, gender, imageurl, time_slots) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [first_name, last_name, speciality, qualification, phone, email, address, age, gender, imageurl, timeSlotsArray]
        );
        res.status(200).send("Doctor added successfully!");
        res.redirect('/admin');
    } catch (err) {
        console.error('Error adding doctor:', err);
        res.status(500).send('Error adding doctor');
    }
});

app.get('/admin/add-patient', (req, res) => {
    res.render('add-patient.ejs');
});

app.post('/add-patient', async (req, res) => {
    const { first_name, last_name, date_of_birth, gender, phone_number, email, address, user_id, password } = req.body;

    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const phoneRegex = /^(\+91\s?)?([6789]\d{9})$/;
    const alpha = /^[A-Za-z\s'-]+$/;

    if(!alpha.test(first_name)) {
        return res.json({ success: false, message: 'First name should contain only alphabets' });
    }

    if(!alpha.test(last_name)) {
        return res.json({ success: false, message: 'Last name should contain only alphabets' });
    }

    if (!emailRegex.test(email)) {
        return res.json({ success: false, message: 'Invalid email format.' });
    }

    if (!phoneRegex.test(phone_number)) {
        return res.json({ success: false, message: 'Invalid phone number. Please enter a valid Indian phone number.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone_number, email, address, user_id, password) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING patient_id',
            [first_name, last_name, date_of_birth, gender, phone_number, email, address, user_id, password]
        );

        const patient_id = result.rows[0].patient_id;

        res.render('add-patient.ejs', { 
            message: { 
                type: 'success', 
                text: `Patient added successfully! Patient ID: ${patient_id}`
            }
        });
    } catch (err) {
        console.error(err);
        res.render('add-patient.ejs', { 
            message: { 
                type: 'error', 
                text: 'Server error, could not add patient.'
            }
        });
    }
});


app.get('/admin/add-patient-record', (req, res) => {
    res.render('add-patient-record.ejs');
});

app.post('/add-patient-record', async (req, res) => {
    //console.log(req.body);
    const { appointment_id, doctor_id, patient_id, appointment_date, treatment, prescription, bill } = req.body;

    try {
        await db.query(
            'INSERT INTO patient_records (appointment_id, doctor_id, patient_id, appointment_date, treatment, prescription, bill, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [appointment_id, doctor_id, patient_id, appointment_date, treatment, prescription, bill]
        );
        res.render('add-patient-record.ejs', { message: { type: 'success', text: 'Patient record added successfully!' }});
    } catch (err) {
        console.error(err);
        res.render('add-patient-record.ejs', { message: { type: 'error', text: 'Server error, could not add patient record.' }});
    }
});

app.get('/admin/list-doctors', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM doctors');
        res.render('list-doctors.ejs', { doctors: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching doctors');
    }
});

app.get('/admin/list-patients', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM patients');
        res.render('list-patients.ejs', { patients: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/user-appointments', isUserAuthenticated, async (req, res) => {
    const userEmail = req.session.user.email;
    try {
        const result = await db.query(
            `SELECT a.appointment_date, a.speciality, a.time_slot, a.doctor_id, d.firstname AS doctor_firstname, d.lastname AS doctor_lastname
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.doctorid
             WHERE a.email = $1`,
            [userEmail]
        );
        const appointments = result.rows;
        res.render('user-appointments.ejs', { appointments });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});



app.get('/doctor', async (req, res) => {
    const doctorId = req.query.doctorId;
    //console.log(req.query);

    try {
        const result = await db.query("SELECT * FROM doctors WHERE doctorid = $1", [doctorId]);
        if (result.rows.length > 0) {
            res.render('doctor.ejs', { doctor: result.rows[0] });
        } else {
            res.status(404).send('Doctor not found');
        }
    } catch (err) {
        console.error('Error fetching doctor details:', err);
        res.status(500).send('Server error');
    }
});


app.get('/search-doctors', async (req, res) => {
    const query = req.query.query.toLowerCase();
    //console.log(query);

    try {
        const result = await db.query("SELECT doctorid, CONCAT(firstname, ' ', lastname) AS name FROM doctors WHERE LOWER(CONCAT(firstname, ' ', lastname)) LIKE $1", [`%${query}%`]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error searching doctors:', err);
        res.status(500).send('Error occurred while searching for doctors.');
    }
});

app.get('/about-us', (req, res) => {
    res.render('about-us.ejs');
});

app.post('/patient-login', async (req, res) => {
    //console.log(req.body.patient_id);
    const { patient_id, password } = req.body;
    
    try {
        const result = await db.query('SELECT * FROM patients WHERE patient_id = $1', [patient_id]);
        if (result.rows.length === 0) {
            return res.json({ success: false, message: 'Patient ID not found!' });
        }
        //console.log(result.rows[0]);
        const patient = result.rows[0];
        let isMatch = false;
        if (patient.password === password) {
            isMatch = true;
        }
        
        if (isMatch) {
            req.session.patient = {
                id: patient.patient_id,
                firstName: patient.first_name,
                lastName: patient.last_name,
                email: patient.email
            };

            res.json({ success: true, message: 'Login successful!' });
        } else {
            res.json({ success: false, message: 'Invalid password!' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error!' });
    }
});

app.get('/patient-login', (req, res) => {
    res.render('patient-login.ejs');
});

app.get('/patient-profile', isPatientAuthenticated, async (req, res) => {
    const patientId = req.session.patient.id;
    const query = "SELECT first_name,last_name,TO_CHAR(date_of_birth, 'YYYY-MM-DD') AS date_of_birth,gender,phone_number,email,address,image FROM patients WHERE patient_id = $1";

    try {
        const result = await db.query(query, [patientId]);
        if (result.rows.length > 0) {
            res.render('patient-profile.ejs', { patient: result.rows[0], patientId : patientId });
        } else {
            res.status(404).send('Patient not found');
        }
    } catch (err) {
        console.error('Error fetching patient details:', err);
        res.status(500).send('Server error');
    }
});

function isPatientAuthenticated(req, res, next) {
    if (req.session.patient) {
        next();
    } else {
        res.redirect('/patient-login');
    }
}

app.get('/patient-appointments', isPatientAuthenticated, async (req, res) => {
    const patientId = req.session.patient.id;
    
    try {
        const result1 = await db.query(`
            SELECT pr.appointment_date, pr.treatment, pr.prescription, pr.bill, 
                   d.firstname AS doctor_first_name, d.lastname AS doctor_last_name
            FROM patient_records pr
            JOIN doctors d ON pr.doctor_id = d.doctorid
            WHERE pr.patient_id = $1
        `, [patientId]);
        
        const appointments = result1.rows;
        res.render('patient-appointments.ejs', { appointments });
    } catch (err) {
        console.error('Error fetching patient appointments:', err);
        res.status(500).send('Server error');
    }
});

const storage = multer.diskStorage({
    destination: './uploads/', 
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
}).single('image');

app.post('/update-patient', async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).send('Error uploading file');
        }
        
        const filePath = req.file ? `/uploads/${req.file.filename}` : null;
        //console.log(filePath)
        const { first_name, last_name, date_of_birth, gender, phone_number, email, address } = req.body;
        const patientId = req.body.patientId;
        //console.log(patientId)
        // console.log(req.session)

        try {
            const query = filePath 
                ? `UPDATE patients SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4, phone_number = $5, email = $6, address = $7, image = $8 WHERE patient_id = $9`
                : `UPDATE patients SET first_name = $1, last_name = $2, date_of_birth = $3, gender = $4, phone_number = $5, email = $6, address = $7 WHERE patient_id = $8`;

            const params = filePath 
                ? [first_name, last_name, date_of_birth, gender, phone_number, email, address, filePath, patientId]
                : [first_name, last_name, date_of_birth, gender, phone_number, email, address, patientId];

            await db.query(query, params);

            res.status(200).json({
                success: true,
                message: 'Profile updated successfully!',
                filePath: filePath || null
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update patient profile' });
        }
    });
});


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            res.redirect('/');
        } else {
            res.redirect('/');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:3000/`);
});
