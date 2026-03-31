const supabase = require('../config/supabase');

async function updateFaculty() {
  console.log('--- Updating Faculty Names ---');
  const { data: faculty, error } = await supabase
    .from('faculty')
    .select('id, name, email')
    .order('id', { ascending: true })
    .limit(20);

  if (error) {
    console.error('Error fetching faculty:', error);
    return;
  }

  const facultyNames = [
    { name: 'Dr. Rajesh Kumar', email: 'rajesh.kumar@rvu.edu.in' },
    { name: 'Prof. Sunita Sharma', email: 'sunita.sharma@rvu.edu.in' },
    { name: 'Dr. Amit Patel', email: 'amit.patel@rvu.edu.in' },
    { name: 'Prof. Priya Iyer', email: 'priya.iyer@rvu.edu.in' },
    { name: 'Dr. Sanjay Gupta', email: 'sanjay.gupta@rvu.edu.in' },
    { name: 'Prof. Anjali Deshmukh', email: 'anjali.deshmukh@rvu.edu.in' },
    { name: 'Dr. Vikram Singh', email: 'vikram.singh@rvu.edu.in' },
    { name: 'Prof. Kavita Reddy', email: 'kavita.reddy@rvu.edu.in' },
    { name: 'Dr. Manoj Tiwari', email: 'manoj.tiwari@rvu.edu.in' },
    { name: 'Prof. Deepa Menon', email: 'deepa.menon@rvu.edu.in' },
    { name: 'Dr. Suresh Rao', email: 'suresh.rao@rvu.edu.in' },
    { name: 'Prof. Meena Joshi', email: 'meena.joshi@rvu.edu.in' },
    { name: 'Dr. Arvind Swamy', email: 'arvind.swamy@rvu.edu.in' },
    { name: 'Prof. Lakshmi Narayanan', email: 'lakshmi.narayanan@rvu.edu.in' },
    { name: 'Dr. Harish Chandra', email: 'harish.chandra@rvu.edu.in' },
    { name: 'Prof. Shanti Devi', email: 'shanti.devi@rvu.edu.in' },
    { name: 'Dr. Prakash Padukone', email: 'prakash.padukone@rvu.edu.in' },
    { name: 'Prof. Geeta Phogat', email: 'geeta.phogat@rvu.edu.in' },
    { name: 'Dr. Rahul Bose', email: 'rahul.bose@rvu.edu.in' },
    { name: 'Prof. Sudha Murthy', email: 'sudha.murthy@rvu.edu.in' }
  ];

  for (let i = 0; i < faculty.length; i++) {
    const f = faculty[i];
    const newF = facultyNames[i];
    if (!newF) break;

    console.log(`Updating faculty ${f.id}: ${f.name} -> ${newF.name}`);

    // Update faculty table
    const { error: fError } = await supabase
      .from('faculty')
      .update({ name: newF.name, email: newF.email })
      .eq('id', f.id);

    if (fError) {
      console.error(`Error updating faculty ${f.id}:`, fError);
      continue;
    }

    // Update user_login table where faculty_id matches
    const { error: uError } = await supabase
      .from('user_login')
      .update({ email: newF.email, username: newF.email.split('@')[0] })
      .eq('faculty_id', f.id);

    if (uError) {
      console.error(`Error updating user_login for faculty ${f.id}:`, uError);
    }
  }
}

async function updateStudents() {
  console.log('\n--- Updating Student Names ---');
  const { data: students, error } = await supabase
    .from('student')
    .select('id, name, email')
    .order('id', { ascending: true })
    .limit(20);

  if (error) {
    console.error('Error fetching students:', error);
    return;
  }

  const studentNames = [
    { name: 'Arjun Mehta', email: 'arjun.mehta@rvu.edu.in' },
    { name: 'Ishani Kapoor', email: 'ishani.kapoor@rvu.edu.in' },
    { name: 'Rohan Varma', email: 'rohan.varma@rvu.edu.in' },
    { name: 'Ananya Das', email: 'ananya.das@rvu.edu.in' },
    { name: 'Kabir Khan', email: 'kabir.khan@rvu.edu.in' },
    { name: 'Diya Malhotra', email: 'diya.malhotra@rvu.edu.in' },
    { name: 'Aditya Chopra', email: 'aditya.chopra@rvu.edu.in' },
    { name: 'Myra Saxena', email: 'myra.saxena@rvu.edu.in' },
    { name: 'Aryan Sharma', email: 'aryan.sharma@rvu.edu.in' },
    { name: 'Zoya Hussain', email: 'zoya.hussain@rvu.edu.in' },
    { name: 'Vivaan Joshi', email: 'vivaan.joshi@rvu.edu.in' },
    { name: 'Navya Nair', email: 'navya.nair@rvu.edu.in' },
    { name: 'Reyansh Gupta', email: 'reyansh.gupta@rvu.edu.in' },
    { name: 'Saanvi Rao', email: 'saanvi.rao@rvu.edu.in' },
    { name: 'Ishaan Bhatt', email: 'ishaan.bhatt@rvu.edu.in' },
    { name: 'Kiara Jain', email: 'kiara.jain@rvu.edu.in' },
    { name: 'Aarav Singh', email: 'aarav.singh@rvu.edu.in' },
    { name: 'Riya Sen', email: 'riya.sen@rvu.edu.in' },
    { name: 'Advait Kulkarni', email: 'advait.kulkarni@rvu.edu.in' },
    { name: 'Tanvi Hegde', email: 'tanvi.hegde@rvu.edu.in' }
  ];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const newS = studentNames[i];
    if (!newS) break;

    console.log(`Updating student ${s.id}: ${s.name} -> ${newS.name}`);

    // Update student table
    const { error: sError } = await supabase
      .from('student')
      .update({ name: newS.name, email: newS.email })
      .eq('id', s.id);

    if (sError) {
      console.error(`Error updating student ${s.id}:`, sError);
      continue;
    }

    // Update user_login table where student_id matches
    const { error: uError } = await supabase
      .from('user_login')
      .update({ email: newS.email, username: newS.email.split('@')[0] })
      .eq('student_id', s.id);

    if (uError) {
      console.error(`Error updating user_login for student ${s.id}:`, uError);
    }
  }
}

async function run() {
  await updateFaculty();
  await updateStudents();
  console.log('\n--- Done! ---');
}

run();
