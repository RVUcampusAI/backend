const supabase = require('../config/supabase');

async function insertMoreStudents() {
  console.log('--- Inserting 20 More Students ---');
  
  const studentNames = [
    { name: 'Pranav Shriram', email: 'pranav.s@rvu.edu.in' },
    { name: 'Meghana Rao', email: 'meghana.r@rvu.edu.in' },
    { name: 'Siddharth Iyer', email: 'siddharth.i@rvu.edu.in' },
    { name: 'Ananya Panday', email: 'ananya.p@rvu.edu.in' },
    { name: 'Varun Dhawan', email: 'varun.d@rvu.edu.in' },
    { name: 'Alia Bhatt', email: 'alia.b@rvu.edu.in' },
    { name: 'Ranbir Kapoor', email: 'ranbir.k@rvu.edu.in' },
    { name: 'Deepika Padukone', email: 'deepika.p@rvu.edu.in' },
    { name: 'Ranveer Singh', email: 'ranveer.s@rvu.edu.in' },
    { name: 'Sara Ali Khan', email: 'sara.ak@rvu.edu.in' },
    { name: 'Janhvi Kapoor', email: 'janhvi.k@rvu.edu.in' },
    { name: 'Ishaan Khatter', email: 'ishaan.k@rvu.edu.in' },
    { name: 'Tara Sutaria', email: 'tara.s@rvu.edu.in' },
    { name: 'Kartik Aaryan', email: 'kartik.a@rvu.edu.in' },
    { name: 'Kriti Sanon', email: 'kriti.s@rvu.edu.in' },
    { name: 'Ayushmann Khurrana', email: 'ayushmann.k@rvu.edu.in' },
    { name: 'Rajkummar Rao', email: 'rajkummar.r@rvu.edu.in' },
    { name: 'Vicky Kaushal', email: 'vicky.k@rvu.edu.in' },
    { name: 'Katrina Kaif', email: 'katrina.k@rvu.edu.in' },
    { name: 'Taapsee Pannu', email: 'taapsee.p@rvu.edu.in' }
  ];

  for (const s of studentNames) {
    console.log(`Inserting student: ${s.name}`);
    const { data, error } = await supabase
      .from('student')
      .insert([{
        name: s.name,
        email: s.email,
        usn: '1RV' + Math.floor(10 + Math.random() * 90) + 'CS' + Math.floor(100 + Math.random() * 900)
      }]);
    
    if (error) {
      console.error(`Error inserting student ${s.name}:`, error);
    }
  }
}

insertMoreStudents().then(() => console.log('--- Done ---'));
