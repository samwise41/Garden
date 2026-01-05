// src/githubSync.js
export const savePlantToGithub = async (newPlant, owner, repo, token) => {
  const path = 'public/plants.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  try {
    // 1. Get current file to get the SHA (required for updates)
    const getRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!getRes.ok) throw new Error('Failed to fetch current plants');
    const getData = await getRes.json();
    
    // 2. Decode content, add new plant, re-encode
    const currentContent = atob(getData.content);
    const plants = JSON.parse(currentContent);
    plants.push(newPlant);
    
    const newContent = btoa(JSON.stringify(plants, null, 2));

    // 3. Commit the update
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add plant: ${newPlant.name}`,
        content: newContent,
        sha: getData.sha
      })
    });

    if (!putRes.ok) throw new Error('GitHub API Error');
    return true;
  } catch (err) {
    console.error(err);
    alert('Error saving to GitHub: ' + err.message);
    return false;
  }
};
