const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

async function insertFaculty() {
  console.log('--- Inserting 20 More Faculty ---');
  
  const facultyData = [
    { name: 'Dr. Ramesh Bhat', email: 'ramesh.bhat@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Prof. Sneha Kulkarni', email: 'sneha.kulkarni@rvu.edu.in', designation: 'Assistant Professor', type: 'lecture' },
    { name: 'Dr. G.V. Prasad', email: 'gv.prasad@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Prof. Lakshmi Hegde', email: 'lakshmi.hegde@rvu.edu.in', designation: 'Assistant Professor', type: 'lecture' },
    { name: 'Dr. Sandeep Kumar', email: 'sandeep.kumar@rvu.edu.in', designation: 'Associate Professor', type: 'lecture' },
    { name: 'Prof. Anitha Rao', email: 'anitha.rao@rvu.edu.in', designation: 'Assistant Professor', type: 'lecture' },
    { name: 'Dr. S.K. Murthy', email: 'sk.murthy@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Prof. Megha Sharma', email: 'megha.sharma@rvu.edu.in', designation: 'Assistant Professor', type: 'lecture' },
    { name: 'Dr. Nitin Gadkari', email: 'nitin.gadkari@rvu.edu.in', designation: 'Associate Professor', type: 'lecture' },
    { name: 'Prof. Shilpa Shetty', email: 'shilpa.shetty@rvu.edu.in', designation: 'Assistant Professor', type: 'lecture' },
    { name: 'Dr. Amitabh Bachchan', email: 'amitabh.b@rvu.edu.in', designation: 'Guest Lecturer', type: 'lecture' },
    { name: 'Prof. Vidya Balan', email: 'vidya.balan@rvu.edu.in', designation: 'Assistant Professor', type: 'lecture' },
    { name: 'Dr. S. Radhakrishnan', email: 's.radhakrishnan@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Prof. Kamala Harris', email: 'kamala.h@rvu.edu.in', designation: 'Guest Faculty', type: 'lecture' },
    { name: 'Dr. A.P.J. Kalam', email: 'apj.kalam@rvu.edu.in', designation: 'Professor Emeritus', type: 'lecture' },
    { name: 'Prof. Sudha Murty', email: 'sudha.m@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Dr. Raghuram Rajan', email: 'raghuram.rajan@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Prof. Arundhati Roy', email: 'arundhati.roy@rvu.edu.in', designation: 'Associate Professor', type: 'lecture' },
    { name: 'Dr. Shashi Tharoor', email: 'shashi.t@rvu.edu.in', designation: 'Professor', type: 'lecture' },
    { name: 'Prof. Kiran Mazumdar', email: 'kiran.m@rvu.edu.in', designation: 'Professor', type: 'lecture' }
  ];

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const f of facultyData) {
    console.log(`Inserting: ${f.name}`);
    
    // 1. Insert into faculty table
    const { data: newFaculty, error: fError } = await supabase
      .from('faculty')
      .insert([{
        name: f.name,
        email: f.email,
        faculty_code: f.email.split('@')[0].toUpperCase() + Math.floor(Math.random() * 1000),
        designation: f.designation
      }])
      .select();

    if (fError) {
      console.error(`Error inserting faculty ${f.name}:`, fError);
      continue;
    }

    const facultyId = newFaculty[0].id;

    // 2. We can't insert into user_login via API due to RLS/Permissions
    // But we need to link it. Let's try inserting it anyway, maybe it's only UPDATE that is blocked.
    const { error: uError } = await supabase
      .from('user_login')
      .insert([{
        username: f.email.split('@')[0],
        email: f.email,
        password_hash: passwordHash,
        role_id: 2, // Assuming 2 is faculty role
        faculty_id: facultyId,
        is_active: true,
        is_verified: true
      }]);

    if (uError) {
      console.warn(`Could not create login for ${f.name} (likely permission issue):`, uError.message);
    } else {
      console.log(`Login created for ${f.name}`);
    }
  }
}

insertFaculty().then(() => console.log('--- Done ---'));
