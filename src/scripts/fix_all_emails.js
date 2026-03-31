const supabase = require('../config/supabase');

async function updateAllEmails() {
  console.log('--- Updating All Faculty Emails to rvu.edu.in ---');
  const { data: faculty, error: fError } = await supabase
    .from('faculty')
    .select('id, email');
  
  if (fError) {
    console.error('Error fetching faculty:', fError);
  } else {
    for (const f of faculty) {
      if (f.email && (f.email.includes('@rvce.edu.in') || !f.email.includes('@rvu.edu.in'))) {
        const newEmail = f.email.split('@')[0] + '@rvu.edu.in';
        console.log(`Updating faculty ${f.id}: ${f.email} -> ${newEmail}`);
        await supabase.from('faculty').update({ email: newEmail }).eq('id', f.id);
      }
    }
  }

  console.log('\n--- Updating All Student Emails to rvu.edu.in ---');
  const { data: students, error: sError } = await supabase
    .from('student')
    .select('id, email');

  if (sError) {
    console.error('Error fetching students:', sError);
  } else {
    for (const s of students) {
      if (s.email && (s.email.includes('@rvce.edu.in') || !s.email.includes('@rvu.edu.in'))) {
        const newEmail = s.email.split('@')[0] + '@rvu.edu.in';
        console.log(`Updating student ${s.id}: ${s.email} -> ${newEmail}`);
        await supabase.from('student').update({ email: newEmail }).eq('id', s.id);
      }
    }
  }
}

updateAllEmails().then(() => console.log('--- Done ---'));
