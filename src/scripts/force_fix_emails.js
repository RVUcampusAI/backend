const supabase = require('../config/supabase');

async function forceFixEmails() {
  console.log('--- Force Fixing Faculty Emails to rvu.edu.in ---');
  const { data: faculty, error } = await supabase
    .from('faculty')
    .select('id, email');

  if (error) {
    console.error('Error fetching faculty:', error);
    return;
  }

  for (const f of faculty) {
    if (f.email && (f.email.includes('@rvce.edu.in') || !f.email.includes('@rvu.edu.in'))) {
      const newEmail = f.email.split('@')[0] + '@rvu.edu.in';
      console.log(`Force updating faculty ${f.id}: ${f.email} -> ${newEmail}`);
      const { error: updateError } = await supabase
        .from('faculty')
        .update({ email: newEmail })
        .eq('id', f.id);
      
      if (updateError) {
        console.error(`Failed to update faculty ${f.id}:`, updateError.message);
      }
    }
  }
}

forceFixEmails().then(() => console.log('--- Done ---'));
