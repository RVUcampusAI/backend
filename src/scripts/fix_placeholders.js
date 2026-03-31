const supabase = require('../config/supabase');

const realisticFacultyNames = [
  'Dr. Ramesh Bhat', 'Prof. Sneha Kulkarni', 'Dr. G.V. Prasad', 'Prof. Lakshmi Hegde', 
  'Dr. Sandeep Kumar', 'Prof. Anitha Rao', 'Dr. S.K. Murthy', 'Prof. Megha Sharma', 
  'Dr. Nitin Gadkari', 'Prof. Shilpa Shetty', 'Dr. Amitabh Bachchan', 'Prof. Vidya Balan', 
  'Dr. S. Radhakrishnan', 'Prof. Kamala Harris', 'Dr. A.P.J. Kalam', 'Prof. Sudha Murty', 
  'Dr. Raghuram Rajan', 'Prof. Arundhati Roy', 'Dr. Shashi Tharoor', 'Prof. Kiran Mazumdar'
];

const realisticStudentNames = [
  'Pranav Shriram', 'Meghana Rao', 'Siddharth Iyer', 'Ananya Panday', 
  'Varun Dhawan', 'Alia Bhatt', 'Ranbir Kapoor', 'Deepika Padukone', 
  'Ranveer Singh', 'Sara Ali Khan', 'Janhvi Kapoor', 'Ishaan Khatter', 
  'Tara Sutaria', 'Kartik Aaryan', 'Kriti Sanon', 'Ayushmann Khurrana', 
  'Rajkummar Rao', 'Vicky Kaushal', 'Katrina Kaif', 'Taapsee Pannu'
];

async function fixPlaceholders() {
  console.log('--- Fixing Placeholder Faculty Names ---');
  const { data: faculty, error: fError } = await supabase
    .from('faculty')
    .select('id, name, email');
  
  if (fError) {
    console.error('Error fetching faculty:', fError);
  } else {
    let nameIndex = 0;
    for (const f of faculty) {
      if (f.name.toLowerCase().includes('faculty')) {
        const newName = realisticFacultyNames[nameIndex % realisticFacultyNames.length] + ' (New)';
        const newEmail = newName.toLowerCase().replace(/\s+/g, '.').replace('..', '.') + '@rvu.edu.in';
        console.log(`Fixing faculty ${f.id}: ${f.name} -> ${newName}`);
        await supabase.from('faculty').update({ name: newName, email: newEmail }).eq('id', f.id);
        nameIndex++;
      }
    }
  }

  console.log('\n--- Fixing Placeholder Student Names ---');
  const { data: students, error: sError } = await supabase
    .from('student')
    .select('id, name, email');

  if (sError) {
    console.error('Error fetching students:', sError);
  } else {
    let nameIndex = 0;
    for (const s of students) {
      if (s.name.toLowerCase().includes('student')) {
        const newName = realisticStudentNames[nameIndex % realisticStudentNames.length] + ' (New)';
        const newEmail = newName.toLowerCase().replace(/\s+/g, '.').replace('..', '.') + '@rvu.edu.in';
        console.log(`Fixing student ${s.id}: ${s.name} -> ${newName}`);
        await supabase.from('student').update({ name: newName, email: newEmail }).eq('id', s.id);
        nameIndex++;
      }
    }
  }
}

fixPlaceholders().then(() => console.log('--- Done ---'));
