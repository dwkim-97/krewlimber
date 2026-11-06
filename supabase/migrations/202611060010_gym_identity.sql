ALTER TABLE gyms ADD COLUMN brandName TEXT NOT NULL DEFAULT '';
ALTER TABLE gyms ADD COLUMN branchName TEXT NOT NULL DEFAULT '';
UPDATE gyms SET brandName=name;
UPDATE gyms SET brandName='더클라임',branchName=regexp_replace(substring(regexp_replace(name,'\s','','g') from 5), '^짐', '') WHERE regexp_replace(name,'\s','','g') LIKE '더클라임%';
UPDATE gyms SET brandName='클라이밍파크',branchName=regexp_replace(substring(regexp_replace(name,'\s','','g') from 7), '^짐', '') WHERE regexp_replace(name,'\s','','g') LIKE '클라이밍파크%';
UPDATE gyms SET brandName='손상원클라이밍',branchName=regexp_replace(substring(regexp_replace(name,'\s','','g') from 8), '^짐', '') WHERE regexp_replace(name,'\s','','g') LIKE '손상원클라이밍%';
UPDATE gyms SET brandName='서울숲클라이밍',branchName=regexp_replace(substring(regexp_replace(name,'\s','','g') from 8), '^짐', '') WHERE regexp_replace(name,'\s','','g') LIKE '서울숲클라이밍%';
