async function main() {
  const res = await fetch('http://localhost:5000/api/user');
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
main();
